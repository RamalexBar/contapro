import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  inventario: { code: "1435", name: "Inventarios - mercancias no fabricadas por la empresa", type: "ASSET" as const },
  // Misma cuenta que usa PostSaleJournalEntryUseCase para el IVA generado: el PUC colombiano
  // netea IVA generado (credito) e IVA descontable (debito) en la cuenta 2408.
  ivaPorPagar: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
  proveedores: { code: "2205", name: "Proveedores nacionales", type: "LIABILITY" as const },
};

export interface PurchaseJournalEntryInput {
  purchaseId: string;
  branchId: string;
  date: Date;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Contabiliza una compra registrada: debito Inventario (base) + IVA descontable, credito
 * Proveedores nacionales por el total de la factura (queda pendiente de pago via
 * AccountPayable). Las cuentas estandar se crean solas la primera vez (upsertByCode).
 */
export class PostPurchaseJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: PurchaseJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.total === 0) return null;

    const accounts = await this.ensureAccounts();

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Compra factura ${input.invoiceNumber}`,
      type: "PURCHASE",
      sourceType: "Purchase",
      sourceId: input.purchaseId,
      lines: [
        { accountId: accounts.inventario.id, debit: input.subtotal, credit: 0, description: "Inventario" },
        { accountId: accounts.ivaPorPagar.id, debit: input.taxTotal, credit: 0, description: "IVA descontable" },
        { accountId: accounts.proveedores.id, debit: 0, credit: input.total, description: "Cuenta por pagar" },
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
