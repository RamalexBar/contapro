import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository } from "../domain/journal-entry.repository";
import type { IBankTransactionRepository } from "../domain/bank-transaction.repository";
import type { ICashSessionRepository } from "../../cash/cash-session/domain/cash-session.repository";

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  balance: number;
}

export interface BalanceSheet {
  asOf: string;
  assets: AccountBalance[];
  totalAssets: number;
  liabilities: AccountBalance[];
  totalLiabilities: number;
  equity: AccountBalance[];
  totalEquity: number;
  netIncome: number;
}

export interface IncomeStatement {
  from: string;
  to: string;
  income: AccountBalance[];
  totalIncome: number;
  expenses: AccountBalance[];
  totalExpenses: number;
  netIncome: number;
}

export interface LedgerEntry {
  entryId: string;
  entryNumber: number;
  date: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CashFlowLine {
  type: string;
  total: number;
}

export interface CashFlowReport {
  from: string;
  to: string;
  cash: CashFlowLine[];
  totalCashIn: number;
  totalCashOut: number;
  netCash: number;
  bank: CashFlowLine[];
  totalBankIn: number;
  totalBankOut: number;
  netBank: number;
  netCashFlow: number;
}

const CASH_INFLOW_TYPES = new Set(["SALE_IN", "INCOME", "DEPOSIT"]);
const BANK_INFLOW_TYPE = "CREDIT";

/**
 * Balance General y Estado de Resultados derivados del libro mayor (JournalEntryLine de
 * comprobantes POSTED), agrupados por tipo de cuenta (AccountType). El Balance General incluye
 * la utilidad del ejercicio (ingresos - gastos del periodo hasta la fecha de corte) dentro del
 * patrimonio, ya que el modulo no maneja cierre contable formal de periodos todavia.
 */
export class AccountingReportsService {
  constructor(
    private readonly journalRepo: IJournalEntryRepository,
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly cashSessionRepo: ICashSessionRepository,
    private readonly bankTransactionRepo: IBankTransactionRepository
  ) {}

  async getBalanceSheet(asOf: Date): Promise<BalanceSheet> {
    const accounts = await this.accountRepo.list();
    const lines = await this.journalRepo.listPostedLines({ to: asOf });
    const byAccount = this.aggregateByAccount(lines);

    const assets: AccountBalance[] = [];
    const liabilities: AccountBalance[] = [];
    const equity: AccountBalance[] = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const account of accounts) {
      const agg = byAccount.get(account.id);
      if (!agg) continue;

      if (account.type === "ASSET") {
        this.pushIfNonZero(assets, account, round2(agg.debit - agg.credit));
      } else if (account.type === "LIABILITY") {
        this.pushIfNonZero(liabilities, account, round2(agg.credit - agg.debit));
      } else if (account.type === "EQUITY") {
        this.pushIfNonZero(equity, account, round2(agg.credit - agg.debit));
      } else if (account.type === "INCOME") {
        totalIncome += agg.credit - agg.debit;
      } else if (account.type === "EXPENSE") {
        totalExpense += agg.debit - agg.credit;
      }
    }

    const netIncome = round2(totalIncome - totalExpense);
    return {
      asOf: asOf.toISOString(),
      assets,
      totalAssets: round2(assets.reduce((sum, a) => sum + a.balance, 0)),
      liabilities,
      totalLiabilities: round2(liabilities.reduce((sum, a) => sum + a.balance, 0)),
      equity,
      totalEquity: round2(equity.reduce((sum, a) => sum + a.balance, 0) + netIncome),
      netIncome,
    };
  }

  async getIncomeStatement(from: Date, to: Date): Promise<IncomeStatement> {
    const accounts = await this.accountRepo.list();
    const lines = await this.journalRepo.listPostedLines({ from, to });
    const byAccount = this.aggregateByAccount(lines);

    const income: AccountBalance[] = [];
    const expenses: AccountBalance[] = [];

    for (const account of accounts) {
      const agg = byAccount.get(account.id);
      if (!agg) continue;

      if (account.type === "INCOME") {
        this.pushIfNonZero(income, account, round2(agg.credit - agg.debit));
      } else if (account.type === "EXPENSE") {
        this.pushIfNonZero(expenses, account, round2(agg.debit - agg.credit));
      }
    }

    const totalIncome = round2(income.reduce((sum, a) => sum + a.balance, 0));
    const totalExpenses = round2(expenses.reduce((sum, a) => sum + a.balance, 0));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      income,
      totalIncome,
      expenses,
      totalExpenses,
      netIncome: round2(totalIncome - totalExpenses),
    };
  }

  async getLedger(accountId: string, from?: Date, to?: Date): Promise<LedgerEntry[]> {
    const account = await this.accountRepo.findByIdOrThrow(accountId);
    const lines = await this.journalRepo.listPostedLines({ accountId, from, to });
    const normalDebit = account.type === "ASSET" || account.type === "EXPENSE";

    let running = 0;
    return lines.map((l) => {
      running += normalDebit ? l.debit - l.credit : l.credit - l.debit;
      return {
        entryId: l.entryId,
        entryNumber: l.entryNumber,
        date: l.date.toISOString(),
        description: l.description,
        debit: l.debit,
        credit: l.credit,
        runningBalance: round2(running),
      };
    });
  }

  /**
   * Flujo de caja simplificado: entradas/salidas de CashMovement (SALE_IN/INCOME/DEPOSIT =
   * entrada, EXPENSE/WITHDRAWAL = salida) y de BankTransaction (CREDIT = entrada, DEBIT = salida
   * -- ver aviso en domain/bank-transaction.repository.ts). No es un Estado de Flujo de Efectivo
   * formal (metodo indirecto desde el Estado de Resultados) -- es un resumen directo de
   * movimientos de caja/banco en el periodo.
   */
  async getCashFlow(from: Date, to: Date): Promise<CashFlowReport> {
    const [cashLines, bankLines] = await Promise.all([
      this.cashSessionRepo.sumMovementsByType(from, to),
      this.bankTransactionRepo.sumByType(from, to),
    ]);

    let totalCashIn = 0;
    let totalCashOut = 0;
    for (const line of cashLines) {
      if (CASH_INFLOW_TYPES.has(line.type)) totalCashIn += line.total;
      else totalCashOut += line.total;
    }

    let totalBankIn = 0;
    let totalBankOut = 0;
    for (const line of bankLines) {
      if (line.type === BANK_INFLOW_TYPE) totalBankIn += line.total;
      else totalBankOut += line.total;
    }

    const netCash = round2(totalCashIn - totalCashOut);
    const netBank = round2(totalBankIn - totalBankOut);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      cash: cashLines.map((l) => ({ type: l.type, total: round2(l.total) })),
      totalCashIn: round2(totalCashIn),
      totalCashOut: round2(totalCashOut),
      netCash,
      bank: bankLines.map((l) => ({ type: l.type, total: round2(l.total) })),
      totalBankIn: round2(totalBankIn),
      totalBankOut: round2(totalBankOut),
      netBank,
      netCashFlow: round2(netCash + netBank),
    };
  }

  private aggregateByAccount(lines: { accountId: string; debit: number; credit: number }[]) {
    const byAccount = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
      const agg = byAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
      agg.debit += line.debit;
      agg.credit += line.credit;
      byAccount.set(line.accountId, agg);
    }
    return byAccount;
  }

  private pushIfNonZero(
    target: AccountBalance[],
    account: { id: string; code: string; name: string },
    balance: number
  ): void {
    if (balance !== 0) target.push({ accountId: account.id, code: account.code, name: account.name, balance });
  }
}
