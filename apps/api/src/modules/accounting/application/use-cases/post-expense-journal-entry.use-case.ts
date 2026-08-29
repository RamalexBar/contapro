import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  // Misma cuenta que usa Post{Sale,Purchase}JournalEntryUseCase: el PUC colombiano netea IVA
  // generado (credito) e IVA descontable (debito) en la cuenta 2408.
  ivaPorPagar: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
};

export interface ExpenseJournalEntryInput {
  expenseId: string;
  branchId: string;
  date: Date;
  payeeName: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  /** Cuenta de gasto resuelta desde ExpenseCategory (accountCode/name) -- a diferencia del resto
   * de Post*JournalEntryUseCase, esta cuenta NO es fija de antemano en STANDARD_ACCOUNTS: cada
   * categoria de gasto tiene la suya propia, se autocrea con upsertByCode igual que las demas. */
  expenseAccountCode: string;
  expenseAccountName: string;
  /** Item 34 de docs/ALCANCE.md -- se copia tal cual al JournalEntry, no afecta ninguna cuenta. */
  costCenterId?: string;
}

/**
 * Contabiliza un gasto operativo registrado (pagado completo de una vez, sin cuentas por pagar):
 * debito la cuenta de la categoria (base gravable) + IVA descontable si aplica, credito Caja
 * (metodo CASH) o Bancos (cualquier otro metodo) por el total. Las cuentas estandar (caja/bancos/
 * IVA) se crean solas la primera vez que se usan (upsertByCode), igual que el resto de
 * Post*JournalEntryUseCase; la cuenta de la categoria se resuelve dinamicamente en cada llamada.
 */
export class PostExpenseJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: ExpenseJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.total === 0) return null;

    const accounts = await this.ensureAccounts();
    const expenseAccount = await this.accountRepo.resolvePostingAccount({
      code: input.expenseAccountCode,
      name: input.expenseAccountName,
      type: "EXPENSE",
    });

    const cashAccount = input.paymentMethod === "CASH" ? accounts.caja : accounts.bancos;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Gasto: ${input.payeeName}`,
      type: "EXPENSE",
      sourceType: "Expense",
      sourceId: input.expenseId,
      costCenterId: input.costCenterId,
      lines: [
        { accountId: expenseAccount.id, debit: input.subtotal, credit: 0, description: input.expenseAccountName },
        { accountId: accounts.ivaPorPagar.id, debit: input.taxTotal, credit: 0, description: "IVA descontable" },
        { accountId: cashAccount.id, debit: 0, credit: input.total, description: input.paymentMethod === "CASH" ? "Efectivo" : "Bancos" },
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
