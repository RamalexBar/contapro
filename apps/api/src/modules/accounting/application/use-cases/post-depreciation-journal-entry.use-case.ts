import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  gastoDepreciacion: { code: "5160", name: "Depreciacion", type: "EXPENSE" as const },
  // Contra-activo: no existe un AccountType separado para eso en este PUC simplificado (solo
  // ASSET/LIABILITY/EQUITY/INCOME/EXPENSE), mismo criterio que el resto de cuentas del sistema
  // que llevan naturaleza credito dentro del tipo ASSET (ej. depreciacion acumulada real del PUC
  // colombiano, cuenta 1592).
  depreciacionAcumulada: { code: "1592", name: "Depreciacion acumulada", type: "ASSET" as const },
};

export interface DepreciationJournalEntryInput {
  depreciationEntryId: string;
  branchId: string;
  date: Date;
  assetName: string;
  amount: number;
}

/**
 * Contabiliza una entrada de depreciacion (item 39 de docs/ALCANCE.md): debito "5160
 * Depreciacion" (gasto) por el monto, credito "1592 Depreciacion acumulada" -- calco de
 * PostCommissionJournalEntryUseCase (sin metodo de pago: la depreciacion no mueve caja, es un
 * gasto no monetario).
 */
export class PostDepreciationJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: DepreciationJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.amount === 0) return null;

    const accounts = await this.ensureAccounts();

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Depreciacion: ${input.assetName}`,
      type: "EXPENSE",
      sourceType: "DepreciationEntry",
      sourceId: input.depreciationEntryId,
      lines: [
        { accountId: accounts.gastoDepreciacion.id, debit: input.amount, credit: 0, description: "Depreciacion" },
        { accountId: accounts.depreciacionAcumulada.id, debit: 0, credit: input.amount, description: "Depreciacion acumulada" },
      ],
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
