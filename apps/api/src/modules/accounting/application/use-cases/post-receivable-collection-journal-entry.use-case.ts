import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  // Misma cuenta que ya debita PostSaleJournalEntryUseCase cuando una venta trae un pago CREDIT
  // -- cobrar despues es lo inverso: baja el activo "Clientes".
  clientes: { code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET" as const },
};

export interface ReceivableCollectionJournalEntryInput {
  accountReceivablePaymentId: string;
  branchId: string;
  date: Date;
  customerName: string;
  amount: number;
  method: string;
}

/**
 * Contabiliza un cobro (abono en persona o pago en linea confirmado) sobre una cuenta por
 * cobrar: debito Caja (metodo CASH) o Bancos (cualquier otro metodo, incluido WOMPI), credito
 * Clientes (baja el activo) -- espejo de PostSupplierPaymentJournalEntryUseCase, mismo criterio
 * de 2 cuentas segun metodo.
 */
export class PostReceivableCollectionJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: ReceivableCollectionJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.amount === 0) return null;

    const accounts = await this.ensureAccounts();
    const isCash = input.method === "CASH";

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Cobro a ${input.customerName}`,
      type: "RECEIVABLE_COLLECTION",
      sourceType: "AccountReceivablePayment",
      sourceId: input.accountReceivablePaymentId,
      lines: [
        { accountId: accounts.caja.id, debit: isCash ? input.amount : 0, credit: 0, description: "Efectivo" },
        { accountId: accounts.bancos.id, debit: isCash ? 0 : input.amount, credit: 0, description: "Bancos" },
        { accountId: accounts.clientes.id, debit: 0, credit: input.amount, description: "Cobro a cliente" },
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
