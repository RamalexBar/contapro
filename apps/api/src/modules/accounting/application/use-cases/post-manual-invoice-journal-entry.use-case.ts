import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import type { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "./post-journal-entry.use-case";
import { CONSUMPTION_TAX_ACCOUNT_CODE } from "./get-vat-summary.use-case";

/** Mismas cuentas que el comprobante de una venta del POS (post-sale-journal-entry.use-case.ts). */
const ACCOUNTS = {
  clientes: { code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET" as const },
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  ingresos: { code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME" as const },
  iva: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
  inc: { code: CONSUMPTION_TAX_ACCOUNT_CODE, name: "Impuesto nacional al consumo por pagar", type: "LIABILITY" as const },
};

export interface ManualInvoiceJournalEntryInput {
  manualInvoiceId: string;
  branchId: string;
  date: Date;
  subtotal: number;
  ivaTotal: number;
  incTotal: number;
  /** Con cliente queda por cobrar (1305); sin cliente (consumidor final) se asume pagada (1105). */
  onCredit: boolean;
  description: string;
}

/**
 * Comprobante de una factura manual: Debito Clientes (o Caja si no tiene cliente) por el total,
 * Credito Ingresos por el subtotal, IVA generado (2408) e impuesto al consumo (240810). Antes las
 * facturas manuales no contabilizaban nada: ni ingreso ni IVA, y no salian en el Resumen de IVA.
 */
export class PostManualInvoiceJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: ManualInvoiceJournalEntryInput): Promise<JournalEntryRecord | null> {
    const total = round2(input.subtotal + input.ivaTotal + input.incTotal);
    if (total <= 0) return null;
    const [debitAccount, ingresos, iva, inc] = await Promise.all([
      this.accountRepo.resolvePostingAccount(input.onCredit ? ACCOUNTS.clientes : ACCOUNTS.caja),
      this.accountRepo.resolvePostingAccount(ACCOUNTS.ingresos),
      this.accountRepo.resolvePostingAccount(ACCOUNTS.iva),
      this.accountRepo.resolvePostingAccount(ACCOUNTS.inc),
    ]);
    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: input.description,
      type: "SALE",
      sourceType: "ManualInvoice",
      sourceId: input.manualInvoiceId,
      lines: [
        { accountId: debitAccount.id, debit: total, credit: 0, description: input.onCredit ? "Cuenta por cobrar al cliente" : "Pago de contado" },
        { accountId: ingresos.id, debit: 0, credit: round2(input.subtotal), description: "Ingreso por factura" },
        { accountId: iva.id, debit: 0, credit: round2(input.ivaTotal), description: "IVA generado" },
        { accountId: inc.id, debit: 0, credit: round2(input.incTotal), description: "Impuesto al consumo" },
      ].filter((l) => l.debit > 0 || l.credit > 0),
    });
    return this.postEntry.execute(entry.id);
  }
}
