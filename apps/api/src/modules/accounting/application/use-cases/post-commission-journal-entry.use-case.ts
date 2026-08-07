import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  comisiones: { code: "5135", name: "Comisiones", type: "EXPENSE" as const },
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
};

export interface CommissionJournalEntryInput {
  settlementId: string;
  branchId: string;
  date: Date;
  sellerName: string;
  commissionAmount: number;
  paymentMethod: string;
}

/**
 * Contabiliza el pago de una liquidacion de comisiones (item 38 de docs/ALCANCE.md): debito
 * cuenta 5135 "Comisiones" por el monto, credito Caja (metodo CASH) o Bancos (cualquier otro
 * metodo) -- calco de PostExpenseJournalEntryUseCase pero sin linea de IVA (una comision a un
 * vendedor no es un servicio de terceros gravado, y se paga de una vez sin cuenta por pagar
 * intermedia, igual que un gasto operativo).
 */
export class PostCommissionJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: CommissionJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.commissionAmount === 0) return null;

    const accounts = await this.ensureAccounts();
    const cashAccount = input.paymentMethod === "CASH" ? accounts.caja : accounts.bancos;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Comision de venta: ${input.sellerName}`,
      type: "EXPENSE",
      sourceType: "Commission",
      sourceId: input.settlementId,
      lines: [
        { accountId: accounts.comisiones.id, debit: input.commissionAmount, credit: 0, description: "Comision" },
        {
          accountId: cashAccount.id,
          debit: 0,
          credit: input.commissionAmount,
          description: input.paymentMethod === "CASH" ? "Efectivo" : "Bancos",
        },
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
