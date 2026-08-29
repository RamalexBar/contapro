import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import type { WithholdingType } from "../../domain/withholding-concept.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const BANK_METHODS = new Set(["CARD", "TRANSFER", "MIXED"]);

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  clientes: { code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET" as const },
  ingresosPorVentas: { code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME" as const },
  // Misma cuenta que usa PostPurchaseJournalEntryUseCase para el IVA descontable: el PUC
  // colombiano netea IVA generado (credito) e IVA descontable (debito) en la cuenta 2408.
  ivaPorPagar: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
  // Retenciones que el CLIENTE practica sobre esta venta: para Contapro (el vendedor) son plata
  // ya "pagada" al fisco por adelantado a su nombre, no un pasivo -- de ahi que sean cuentas de
  // ACTIVO (anticipo de impuestos), no de pasivo como en post-purchase-journal-entry.use-case.ts
  // (donde Contapro es quien retiene). Una cuenta fija por tipo, nunca por concepto -- mismo
  // criterio que 2408 para IVA sin importar la tarifa.
  anticipoRetefuente: { code: "135515", name: "Anticipo de impuestos - Retencion en la fuente", type: "ASSET" as const },
  anticipoReteica: { code: "135517", name: "Anticipo de impuestos - Retencion de ICA", type: "ASSET" as const },
  anticipoReteiva: { code: "135518", name: "Anticipo de impuestos - Retencion de IVA", type: "ASSET" as const },
  // Mismo par de cuentas que PostPurchaseJournalEntryUseCase usa para el lado del debito al
  // comprar (1435) -- resueltas por codigo via upsertByCode, asi que apuntan a la misma fila sin
  // importar cual de los dos casos de uso la crea primero.
  costoVenta: { code: "6135", name: "Costo de ventas", type: "EXPENSE" as const },
  inventario: { code: "1435", name: "Inventarios - mercancias no fabricadas por la empresa", type: "ASSET" as const },
};

const WITHHOLDING_ACCOUNT_KEY: Record<WithholdingType, "anticipoRetefuente" | "anticipoReteica" | "anticipoReteiva"> = {
  RETEFUENTE: "anticipoRetefuente",
  RETEICA: "anticipoReteica",
  RETEIVA: "anticipoReteiva",
};

export interface SaleJournalEntryInput {
  saleId: string;
  branchId: string;
  date: Date;
  number: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  retentionTotal: number;
  withholdingsByType: Record<WithholdingType, number>;
  payments: { method: string; amount: number }[];
  // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- opcional para no romper callers/
  // fixtures existentes; default "COP"/1 no cambia la descripcion del comprobante. Los montos
  // debito/credito de este comprobante SIEMPRE son en COP, sin importar estos dos campos.
  currency?: string;
  exchangeRate?: number;
  // Costo real de lo vendido (FIFO: suma de los lotes realmente consumidos; promedio/ultimo: al
  // costo del producto al momento de la venta) -- opcional para no romper callers/fixtures
  // existentes; sin el, el comprobante sigue contabilizando solo el ingreso, igual que antes.
  costOfGoodsSold?: number;
}

/**
 * Contabiliza una venta COMPLETED: debito Caja (efectivo), Bancos (tarjeta/transferencia),
 * Clientes (saldo no cubierto por los pagos registrados, ej. ventas a credito) y/o Anticipo de
 * impuestos (retenciones practicadas por el cliente, ver STANDARD_ACCOUNTS arriba); credito
 * Ingresos por ventas (base gravable) + IVA generado. `total` sigue siendo el bruto legal de la
 * factura -- lo que cambia con retencion es como se reparte ese debito entre caja/bancos/clientes
 * (neto de lo retenido, `netTotal`) y las 3 cuentas de anticipo. Las cuentas estandar se crean
 * solas la primera vez que se usan (upsertByCode), igual que en PostPayrollJournalEntryUseCase.
 *
 * Si `costOfGoodsSold` viene con un valor, agrega ademas el asiento espejo del costo: debito
 * "Costo de ventas" (6135), credito "Inventarios" (1435) -- mismo par de cuentas que
 * PostPurchaseJournalEntryUseCase debita al comprar. Sin este campo (fixtures/callers viejos), el
 * comprobante queda identico a como era antes de que existiera este campo.
 */
export class PostSaleJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: SaleJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.total === 0) return null;

    const accounts = await this.ensureAccounts();
    const taxableBase = round2(input.subtotal - input.discountTotal);
    const netTotal = round2(input.total - input.retentionTotal);

    let cash = 0;
    let bank = 0;
    let otherPayments = 0;
    for (const payment of input.payments) {
      if (payment.method === "CASH") cash += payment.amount;
      else if (BANK_METHODS.has(payment.method)) bank += payment.amount;
      else otherPayments += payment.amount;
    }
    const paymentsTotal = round2(cash + bank + otherPayments);
    const receivable = round2(otherPayments + (netTotal - paymentsTotal));

    const withholdingLines = (Object.entries(input.withholdingsByType) as [WithholdingType, number][]).map(
      ([type, amount]) => ({
        accountId: accounts[WITHHOLDING_ACCOUNT_KEY[type]].id,
        debit: round2(amount),
        credit: 0,
        description: `Retencion practicada por el cliente (${type})`,
      })
    );

    const currency = input.currency ?? "COP";
    const exchangeRate = input.exchangeRate ?? 1;
    const description =
      currency === "COP"
        ? `Venta #${input.number}`
        : `Venta #${input.number} (${currency} ${round2(input.total / exchangeRate)} @ TRM ${exchangeRate})`;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description,
      type: "SALE",
      sourceType: "Sale",
      sourceId: input.saleId,
      lines: [
        { accountId: accounts.caja.id, debit: round2(cash), credit: 0, description: "Efectivo" },
        { accountId: accounts.bancos.id, debit: round2(bank), credit: 0, description: "Tarjeta/transferencia" },
        { accountId: accounts.clientes.id, debit: receivable, credit: 0, description: "Ventas a credito" },
        ...withholdingLines,
        { accountId: accounts.ingresosPorVentas.id, debit: 0, credit: taxableBase, description: "Ingreso por ventas" },
        { accountId: accounts.ivaPorPagar.id, debit: 0, credit: input.taxTotal, description: "IVA generado" },
        { accountId: accounts.costoVenta.id, debit: round2(input.costOfGoodsSold ?? 0), credit: 0, description: "Costo de venta" },
        { accountId: accounts.inventario.id, debit: 0, credit: round2(input.costOfGoodsSold ?? 0), description: "Salida de inventario" },
      ].filter((line) => line.debit > 0 || line.credit > 0),
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
    return Object.fromEntries(entries) as Record<keyof typeof STANDARD_ACCOUNTS, Awaited<ReturnType<IChartOfAccountsRepository["resolvePostingAccount"]>>>;
  }
}
