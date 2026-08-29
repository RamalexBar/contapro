import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  sobrantes: { code: "4295", name: "Diversos (otros ingresos)", type: "INCOME" as const },
  faltantes: { code: "5195", name: "Diversos (gastos)", type: "EXPENSE" as const },
};

export interface CashSessionAdjustmentJournalEntryInput {
  cashSessionId: string;
  branchId: string;
  date: Date;
  difference: number; // contado - esperado: positivo = sobrante, negativo = faltante
}

/**
 * Contabiliza la diferencia de un arqueo de caja: sobrante (contado > esperado) va a una cuenta
 * de otros ingresos, faltante (contado < esperado) a una cuenta de gastos diversos -- mismo
 * patron STANDARD_ACCOUNTS/ensureAccounts que el resto de Post*JournalEntryUseCase.
 */
export class PostCashSessionAdjustmentJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: CashSessionAdjustmentJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (!input.difference) return null;

    const accounts = await this.ensureAccounts();
    const amount = Math.abs(input.difference);
    const isSurplus = input.difference > 0;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: isSurplus ? "Sobrante de caja en arqueo" : "Faltante de caja en arqueo",
      type: "CASH_ADJUSTMENT",
      sourceType: "CashSession",
      sourceId: input.cashSessionId,
      lines: [
        { accountId: accounts.caja.id, debit: isSurplus ? amount : 0, credit: isSurplus ? 0 : amount, description: "Caja" },
        {
          accountId: isSurplus ? accounts.sobrantes.id : accounts.faltantes.id,
          debit: isSurplus ? 0 : amount,
          credit: isSurplus ? amount : 0,
          description: isSurplus ? "Sobrante en caja" : "Faltante en caja",
        },
      ],
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
