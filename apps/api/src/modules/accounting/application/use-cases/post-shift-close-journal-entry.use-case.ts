import { round2 } from "@erp/shared-utils";
import type { RegisterShiftCloseInput, ShiftCloseTaxType } from "@erp/shared-types";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

/**
 * Cuentas marcadas "reusa" ya las usa otro Post*JournalEntryUseCase de este mismo modulo (mismo
 * codigo, misma cuenta real por empresa via resolvePostingAccount). Las marcadas "NUEVA, SIN
 * VERIFICAR" son un codigo razonable del PUC estandar colombiano pero no se confirmaron contra
 * el plan de cuentas oficial de una empresa real -- mismo criterio de honestidad que el resto del
 * codebase (ver ej. dian-soap-client.ts, factus-invoicing-client.ts): el contador de cada empresa
 * puede reclasificar la cuenta despues sin romper nada (resolvePostingAccount crea la cuenta la
 * primera vez que se usa, pero una vez creada el usuario es libre de moverla en su plan de
 * cuentas).
 */
const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const }, // reusa
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const }, // reusa
  ingresosPorVentas: { code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME" as const }, // reusa
  ivaPorPagar: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const }, // reusa
  incPorPagar: { code: "240810", name: "Impuesto al consumo por pagar", type: "LIABILITY" as const }, // NUEVA, SIN VERIFICAR
  devolucionesEnVentas: { code: "4175", name: "Devoluciones en ventas", type: "INCOME" as const }, // NUEVA, SIN VERIFICAR
  anticiposClientes: { code: "2805", name: "Anticipos y avances recibidos de clientes", type: "LIABILITY" as const }, // NUEVA, SIN VERIFICAR
  inventarioUsados: { code: "143506", name: "Inventario de mercancias usadas", type: "ASSET" as const }, // NUEVA, SIN VERIFICAR
  cuentasPorCobrarPlataformas: { code: "133595", name: "Cuentas por cobrar - plataformas de domicilios", type: "ASSET" as const }, // NUEVA, SIN VERIFICAR
  gastosCaja: { code: "5150", name: "Gastos diversos de caja menor", type: "EXPENSE" as const }, // NUEVA -- deliberadamente distinta de 5195 (faltantes) para no mezclar ambos conceptos en una sola cuenta
  retirosPropietario: { code: "3115", name: "Retiros del propietario", type: "EQUITY" as const }, // NUEVA, SIN VERIFICAR -- depende del tipo societario, el contador puede necesitar otra
  sobrantes: { code: "4295", name: "Diversos (otros ingresos)", type: "INCOME" as const }, // reusa (mismo codigo que PostCashSessionAdjustmentJournalEntryUseCase)
  faltantes: { code: "5195", name: "Diversos (gastos)", type: "EXPENSE" as const }, // reusa (idem)
};

type AccountKey = keyof typeof STANDARD_ACCOUNTS;

const TAX_ACCOUNT_BY_TYPE: Partial<Record<ShiftCloseTaxType, AccountKey>> = {
  IVA: "ivaPorPagar",
  INC: "incPorPagar",
};

export interface ShiftCloseJournalEntryInput extends RegisterShiftCloseInput {
  branchId: string;
}

/**
 * Contabiliza TODO un cierre de turno de POS externo en un solo comprobante (no uno por venta --
 * decision explicita del usuario 2026-09-29, ver public-api/README.md). El POS manda conceptos
 * (efectivo/tarjeta/anticipo/etc.), esta funcion los convierte a las cuentas del PUC de la
 * empresa via STANDARD_ACCOUNTS + resolvePostingAccount (mismo patron que el resto de
 * Post*JournalEntryUseCase de este modulo).
 *
 * Acumula debitos/creditos por cuenta en un mapa antes de armar las lineas (en vez de emitir una
 * linea por cada item de la lista) para que el comprobante quede compacto -- un turno con 200
 * ventas en efectivo genera UNA linea de Caja, no 200.
 */
export class PostShiftCloseJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(externalShiftCloseId: string, input: ShiftCloseJournalEntryInput): Promise<JournalEntryRecord | null> {
    const accounts = await this.ensureAccounts();
    const totals = new Map<AccountKey, { debit: number; credit: number }>();
    const add = (key: AccountKey, debit: number, credit: number) => {
      const current = totals.get(key) ?? { debit: 0, credit: 0 };
      totals.set(key, { debit: round2(current.debit + debit), credit: round2(current.credit + credit) });
    };

    // 1. Como entro el dinero de las ventas del turno.
    for (const payment of input.payments) {
      if (payment.method === "CASH") add("caja", payment.amount, 0);
      else if (payment.method === "CARD" || payment.method === "TRANSFER") add("bancos", payment.amount, 0);
      else if (payment.method === "TRADE_IN") add("inventarioUsados", payment.amount, 0);
      else if (payment.method === "PLATFORM") add("cuentasPorCobrarPlataformas", payment.amount, 0);
    }

    // 2. Ingreso + IVA/INC generado, por tarifa.
    for (const line of input.salesTaxBreakdown) {
      add("ingresosPorVentas", 0, line.taxableBase);
      const taxAccount = TAX_ACCOUNT_BY_TYPE[line.taxType];
      if (taxAccount && line.taxAmount > 0) add(taxAccount, 0, line.taxAmount);
    }

    // 3. Devoluciones: reversa ingreso + impuesto, sale plata de caja/bancos.
    for (const ret of input.returns) {
      add("devolucionesEnVentas", ret.taxableAmount, 0);
      const taxAccount = TAX_ACCOUNT_BY_TYPE[ret.taxType];
      if (taxAccount && ret.taxAmount > 0) add(taxAccount, ret.taxAmount, 0);
      const refundTotal = round2(ret.taxableAmount + ret.taxAmount);
      if (ret.refundMethod === "CASH") add("caja", 0, refundTotal);
      else add("bancos", 0, refundTotal);
    }

    // 4. Gastos pagados de caja: salen de Caja, entran como gasto.
    for (const expense of input.expenses) {
      add("gastosCaja", expense.amount, 0);
      add("caja", 0, expense.amount);
    }

    // 5. Retiros del propietario: salen de Caja.
    for (const withdrawal of input.withdrawals) {
      add("retirosPropietario", withdrawal.amount, 0);
      add("caja", 0, withdrawal.amount);
    }

    // 6. Anticipos (apartados/ordenes de servicio): entra plata, pero es pasivo, NO ingreso,
    // hasta que se entregue lo comprado.
    for (const advance of input.advances) {
      if (advance.method === "CASH") add("caja", advance.amount, 0);
      else add("bancos", advance.amount, 0);
      add("anticiposClientes", 0, advance.amount);
    }

    // 7. Arqueo: diferencia entre lo esperado y lo contado -- sobrante (otro ingreso) o faltante
    // (gasto), mismo tratamiento que PostCashSessionAdjustmentJournalEntryUseCase.
    const difference = round2(input.cashCounted - input.cashExpected);
    if (difference > 0) {
      add("caja", difference, 0);
      add("sobrantes", 0, difference);
    } else if (difference < 0) {
      const amount = Math.abs(difference);
      add("faltantes", amount, 0);
      add("caja", 0, amount);
    }

    // Cada cuenta puede haber acumulado debitos Y creditos (ej. Caja recibe ventas en efectivo
    // pero tambien paga gastos en el mismo turno) -- CreateJournalEntryUseCase exige que cada
    // linea sea SOLO debito o SOLO credito, asi que se netea antes de emitir.
    const lines = (Object.entries(Object.fromEntries(totals)) as [AccountKey, { debit: number; credit: number }][])
      .map(([key, v]) => [key, round2(v.debit - v.credit)] as const)
      .filter(([, net]) => net !== 0)
      .map(([key, net]) => ({
        accountId: accounts[key].id,
        debit: net > 0 ? net : 0,
        credit: net < 0 ? -net : 0,
        description: STANDARD_ACCOUNTS[key].name,
      }));

    if (lines.length === 0) return null;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Cierre de turno ${input.externalReference}`,
      type: "SHIFT_CLOSE",
      sourceType: "ExternalShiftClose",
      sourceId: externalShiftCloseId,
      lines,
    });

    return this.postEntry.execute(entry.id);
  }

  private async ensureAccounts() {
    const entries = await Promise.all(
      Object.entries(STANDARD_ACCOUNTS).map(async ([key, def]) => {
        const account = await this.accountRepo.resolvePostingAccount(def);
        return [key, account] as const;
      })
    );
    return Object.fromEntries(entries) as Record<AccountKey, Awaited<ReturnType<IChartOfAccountsRepository["resolvePostingAccount"]>>>;
  }
}
