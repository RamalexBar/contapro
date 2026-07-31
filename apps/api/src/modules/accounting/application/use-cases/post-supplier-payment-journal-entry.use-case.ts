import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  proveedores: { code: "2205", name: "Proveedores nacionales", type: "LIABILITY" as const },
};

export interface SupplierPaymentJournalEntryInput {
  supplierPaymentId: string;
  branchId: string;
  date: Date;
  supplierName: string;
  amount: number;
  method: string;
}

/**
 * Contabiliza un abono a una cuenta por pagar: debito Proveedores nacionales (baja el pasivo),
 * credito Caja general (metodo CASH) o Bancos (cualquier otro metodo) -- misma idea que
 * PostSaleJournalEntryUseCase usa para clasificar el metodo de pago, simplificada a 2 cuentas
 * (un abono a proveedor no tiene el caso "clientes"/cuentas por cobrar que si aplica a ventas).
 */
export class PostSupplierPaymentJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: SupplierPaymentJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.amount === 0) return null;

    const accounts = await this.ensureAccounts();
    const isCash = input.method === "CASH";

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Abono a proveedor ${input.supplierName}`,
      type: "SUPPLIER_PAYMENT",
      sourceType: "SupplierPayment",
      sourceId: input.supplierPaymentId,
      lines: [
        { accountId: accounts.proveedores.id, debit: input.amount, credit: 0, description: "Abono a proveedor" },
        { accountId: accounts.caja.id, debit: 0, credit: isCash ? input.amount : 0, description: "Efectivo" },
        { accountId: accounts.bancos.id, debit: 0, credit: isCash ? 0 : input.amount, description: "Bancos" },
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
