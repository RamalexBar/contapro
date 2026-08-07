import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  clientes: { code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET" as const },
  ingresosPorVentas: { code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME" as const },
  ivaPorPagar: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
  costoVenta: { code: "6135", name: "Costo de ventas", type: "EXPENSE" as const },
  inventario: { code: "1435", name: "Inventarios - mercancias no fabricadas por la empresa", type: "ASSET" as const },
};

export type RefundMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT_TO_ACCOUNT";

export interface ReturnJournalEntryInput {
  returnId: string;
  branchId: string;
  date: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  refundMethod: RefundMethod;
  // Costo real de lo que fisicamente volvio a inventario (solo items con restockedToBranch,
  // mismo criterio que PrismaReturnRepository -- lo no restockeado no reingresa a bodega, asi
  // que tampoco reversa su costo). Opcional para no romper callers/fixtures existentes.
  costOfGoodsSold?: number;
}

/**
 * Contabiliza una devolucion: reverso (en espejo) de PostSaleJournalEntryUseCase -- debito
 * Ingresos por ventas + IVA generado por el monto devuelto, credito la cuenta que corresponda al
 * `refundMethod` elegido por quien registra la devolucion. A proposito NO se reconstruye la
 * mezcla de pagos original de la venta (efectivo/tarjeta/credito): un reembolso puede salir por
 * un medio distinto al que se pago, asi que se pide explicito. Mismas cuentas estandar (mismos
 * codigos) que PostSaleJournalEntryUseCase, resueltas a la misma fila via upsertByCode.
 *
 * Si `costOfGoodsSold` viene con un valor, agrega tambien el espejo del costo en reversa: debito
 * "Inventarios" (1435), credito "Costo de ventas" (6135).
 */
export class PostReturnJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: ReturnJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.total === 0) return null;

    const accounts = await this.ensureAccounts();
    const creditAccount =
      input.refundMethod === "CASH"
        ? accounts.caja
        : input.refundMethod === "CREDIT_TO_ACCOUNT"
          ? accounts.clientes
          : accounts.bancos;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: "Devolucion de venta",
      type: "RETURN",
      sourceType: "Return",
      sourceId: input.returnId,
      lines: [
        { accountId: accounts.ingresosPorVentas.id, debit: round2(input.subtotal), credit: 0, description: "Reverso de ingreso por devolucion" },
        { accountId: accounts.ivaPorPagar.id, debit: round2(input.taxTotal), credit: 0, description: "Reverso de IVA generado" },
        { accountId: creditAccount.id, debit: 0, credit: round2(input.total), description: "Reembolso al cliente" },
        { accountId: accounts.inventario.id, debit: round2(input.costOfGoodsSold ?? 0), credit: 0, description: "Reingreso de inventario por devolucion" },
        { accountId: accounts.costoVenta.id, debit: 0, credit: round2(input.costOfGoodsSold ?? 0), description: "Reverso de costo de venta" },
      ].filter((line) => line.debit > 0 || line.credit > 0),
    });

    return this.postEntry.execute(entry.id);
  }

  private async ensureAccounts() {
    const entries = await Promise.all(
      Object.entries(STANDARD_ACCOUNTS).map(async ([key, def]) => {
        const account = await this.accountRepo.upsertByCode(def);
        return [key, account] as const;
      })
    );
    return Object.fromEntries(entries) as Record<keyof typeof STANDARD_ACCOUNTS, Awaited<ReturnType<IChartOfAccountsRepository["upsertByCode"]>>>;
  }
}
