import { apiFetch } from "../../../lib/api-client";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export interface AccountRecord {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  level: number;
  isActive: boolean;
  acceptsEntries: boolean;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  acceptsEntries?: boolean;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
}

export interface JournalEntryRecord {
  id: string;
  number: number;
  date: string;
  description: string;
  type: string;
  sourceType: string | null;
  sourceId: string | null;
  status: string;
  createdByUserId: string;
  postedAt: string | null;
  lines: JournalEntryLine[];
}

export interface CreateJournalEntryLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  date: string;
  description: string;
  lines: CreateJournalEntryLineInput[];
}

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

export interface LedgerEntry {
  entryId: string;
  entryNumber: number;
  date: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export function listAccounts(): Promise<{ data: AccountRecord[] }> {
  return apiFetch("/chart-of-accounts");
}

export function createAccount(input: CreateAccountInput): Promise<AccountRecord> {
  return apiFetch("/chart-of-accounts", { method: "POST", body: input });
}

export function listEntries(status?: string): Promise<{ data: JournalEntryRecord[] }> {
  return apiFetch(`/journal-entries${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}

export function createEntry(input: CreateJournalEntryInput): Promise<JournalEntryRecord> {
  return apiFetch("/journal-entries", { method: "POST", body: input });
}

export function postEntry(id: string): Promise<JournalEntryRecord> {
  return apiFetch(`/journal-entries/${id}/post`, { method: "POST" });
}

export function voidEntry(id: string): Promise<JournalEntryRecord> {
  return apiFetch(`/journal-entries/${id}/void`, { method: "POST" });
}

export function getBalanceSheet(asOf?: string): Promise<BalanceSheet> {
  return apiFetch(`/reports/balance-sheet${asOf ? `?asOf=${asOf}` : ""}`);
}

export function getIncomeStatement(from: string, to: string): Promise<IncomeStatement> {
  return apiFetch(`/reports/income-statement?from=${from}&to=${to}`);
}

export function getCashFlow(from: string, to: string): Promise<CashFlowReport> {
  return apiFetch(`/reports/cash-flow?from=${from}&to=${to}`);
}

export function getLedger(accountId: string, from?: string, to?: string): Promise<{ data: LedgerEntry[] }> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return apiFetch(`/reports/ledger/${accountId}${query ? `?${query}` : ""}`);
}
