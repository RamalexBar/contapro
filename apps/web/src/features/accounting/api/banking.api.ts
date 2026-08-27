import { apiFetch } from "../../../lib/api-client";

export interface BankAccountRecord {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  currentBalance: number;
}

export interface CreateBankAccountInput {
  bankName: string;
  accountNumber: string;
  accountType: string;
}

export interface BankTransactionRecord {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  reconciled: boolean;
}

export interface RegisterBankTransactionInput {
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
}

export interface BankReconciliationItem {
  id: string;
  bankTransactionId: string | null;
  journalEntryLineId: string | null;
  matched: boolean;
}

export interface BankReconciliationRecord {
  id: string;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementBalance: number;
  bookBalance: number;
  status: string;
  createdAt: string;
  items: BankReconciliationItem[];
}

export interface StartBankReconciliationInput {
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementBalance: number;
  bookBalance: number;
}

export function listBankAccounts(): Promise<{ data: BankAccountRecord[] }> {
  return apiFetch("/bank-accounts");
}

export function createBankAccount(input: CreateBankAccountInput): Promise<BankAccountRecord> {
  return apiFetch("/bank-accounts", { method: "POST", body: input });
}

export function listBankTransactions(bankAccountId: string): Promise<{ data: BankTransactionRecord[] }> {
  return apiFetch(`/bank-accounts/${bankAccountId}/transactions`);
}

export function registerBankTransaction(bankAccountId: string, input: RegisterBankTransactionInput): Promise<BankTransactionRecord> {
  return apiFetch(`/bank-accounts/${bankAccountId}/transactions`, { method: "POST", body: input });
}

export function listBankReconciliations(): Promise<{ data: BankReconciliationRecord[] }> {
  return apiFetch("/bank-reconciliations");
}

export function getBankReconciliation(id: string): Promise<BankReconciliationRecord> {
  return apiFetch(`/bank-reconciliations/${id}`);
}

export function startBankReconciliation(input: StartBankReconciliationInput): Promise<BankReconciliationRecord> {
  return apiFetch("/bank-reconciliations", { method: "POST", body: input });
}

export interface SuggestedBankMatch {
  bankTransactionId: string;
  journalEntryLineId: string;
  amount: number;
  bankTransactionDate: string;
  journalEntryDate: string;
  journalEntryNumber: number;
  daysApart: number;
  confidence: "EXACT" | "PROBABLE";
  descriptionSimilarity: number;
}

export function getSuggestedBankReconciliationMatches(id: string): Promise<{ data: SuggestedBankMatch[] }> {
  return apiFetch(`/bank-reconciliations/${id}/suggested-matches`);
}

export function matchBankReconciliationItem(
  id: string,
  data: { bankTransactionId?: string; journalEntryLineId?: string }
): Promise<BankReconciliationRecord> {
  return apiFetch(`/bank-reconciliations/${id}/match`, { method: "POST", body: data });
}

export function closeBankReconciliation(id: string): Promise<BankReconciliationRecord> {
  return apiFetch(`/bank-reconciliations/${id}/close`, { method: "POST" });
}
