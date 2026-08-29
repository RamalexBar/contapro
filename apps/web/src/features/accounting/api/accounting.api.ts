import { apiFetch, openPdfInNewTab } from "../../../lib/api-client";

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

export interface UpdateAccountInput {
  name: string;
}

/** Nivel maximo (clase=1/grupo=2/cuenta=3) que se considera "cuenta principal" del PUC -- fija,
 * no editable. Misma frontera que MAX_PRINCIPAL_ACCOUNT_LEVEL en el backend
 * (apps/api/src/modules/accounting/domain/chart-of-accounts.repository.ts). */
export const MAX_PRINCIPAL_ACCOUNT_LEVEL = 3;

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
  costCenterId: string | null;
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
  costCenterId?: string;
}

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  balance: number;
  /** Presente solo cuando getBalanceSheet se llama con byThirdParty:true, para cuentas de
   * Clientes/Proveedores -- una fila por tercero en vez del total agregado de la cuenta. */
  thirdPartyName?: string;
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

export function updateAccount(id: string, input: UpdateAccountInput): Promise<AccountRecord> {
  return apiFetch(`/chart-of-accounts/${id}`, { method: "PATCH", body: input });
}

export function activateAccount(id: string): Promise<AccountRecord> {
  return apiFetch(`/chart-of-accounts/${id}/activate`, { method: "POST" });
}

export function deactivateAccount(id: string): Promise<AccountRecord> {
  return apiFetch(`/chart-of-accounts/${id}/deactivate`, { method: "POST" });
}

/** Reverso manual de que una cuenta principal haya dejado de admitir movimientos directos al
 * ganar una subcuenta -- rechaza si todavia le queda alguna subcuenta activa. */
export function enableAccountDirectEntries(id: string): Promise<AccountRecord> {
  return apiFetch(`/chart-of-accounts/${id}/enable-entries`, { method: "POST" });
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

/** Abre el PDF del comprobante en una pestana nueva (mismo patron que printThermalReceipt en
 * pos/api/sale.api.ts) -- el endpoint exige el token en el header Authorization, asi que no sirve
 * un <a href> directo. Desde ahi el usuario imprime con Ctrl+P / el icono de impresora del lector
 * de PDF del navegador. */
export function printJournalEntryPdf(entryId: string): Promise<void> {
  return openPdfInNewTab(`/journal-entries/${entryId}/pdf`);
}

export function getBalanceSheet(asOf?: string, byThirdParty?: boolean): Promise<BalanceSheet> {
  const params = new URLSearchParams();
  if (asOf) params.set("asOf", asOf);
  if (byThirdParty) params.set("byThirdParty", "true");
  const query = params.toString();
  return apiFetch(`/reports/balance-sheet${query ? `?${query}` : ""}`);
}

export function getIncomeStatement(from: string, to: string, costCenterId?: string): Promise<IncomeStatement> {
  const params = new URLSearchParams({ from, to });
  if (costCenterId) params.set("costCenterId", costCenterId);
  return apiFetch(`/reports/income-statement?${params.toString()}`);
}

export function getCashFlow(from: string, to: string): Promise<CashFlowReport> {
  return apiFetch(`/reports/cash-flow?from=${from}&to=${to}`);
}

export function getLedger(accountId: string, from?: string, to?: string, costCenterId?: string): Promise<{ data: LedgerEntry[] }> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (costCenterId) params.set("costCenterId", costCenterId);
  const query = params.toString();
  return apiFetch(`/reports/ledger/${accountId}${query ? `?${query}` : ""}`);
}

export interface FinancialPeriodRecord {
  id: string;
  year: number;
  month: number;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
}

export function listFinancialPeriods(year?: number): Promise<{ data: FinancialPeriodRecord[] }> {
  return apiFetch(`/financial-periods${year ? `?year=${year}` : ""}`);
}

export function closeFinancialPeriod(year: number, month: number): Promise<FinancialPeriodRecord> {
  return apiFetch(`/financial-periods/${year}/${month}/close`, { method: "POST" });
}

export function reopenFinancialPeriod(year: number, month: number): Promise<FinancialPeriodRecord> {
  return apiFetch(`/financial-periods/${year}/${month}/reopen`, { method: "POST" });
}

export type WithholdingType = "RETEFUENTE" | "RETEICA" | "RETEIVA";

export interface WithholdingConceptRecord {
  id: string;
  code: string;
  name: string;
  type: WithholdingType;
  ratePercent: number;
  isActive: boolean;
  dianConceptCode: string | null;
}

export interface CreateWithholdingConceptInput {
  code: string;
  name: string;
  type: WithholdingType;
  ratePercent: number;
  dianConceptCode?: string;
}

export interface UpdateWithholdingConceptInput {
  name?: string;
  ratePercent?: number;
  dianConceptCode?: string;
}

export function listWithholdingConcepts(): Promise<{ data: WithholdingConceptRecord[] }> {
  return apiFetch("/withholding-concepts");
}

export function createWithholdingConcept(input: CreateWithholdingConceptInput): Promise<WithholdingConceptRecord> {
  return apiFetch("/withholding-concepts", { method: "POST", body: input });
}

export function updateWithholdingConcept(id: string, input: UpdateWithholdingConceptInput): Promise<WithholdingConceptRecord> {
  return apiFetch(`/withholding-concepts/${id}`, { method: "PATCH", body: input });
}

export function deactivateWithholdingConcept(id: string): Promise<WithholdingConceptRecord> {
  return apiFetch(`/withholding-concepts/${id}/deactivate`, { method: "POST" });
}

export interface CostCenterRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreateCostCenterInput {
  code: string;
  name: string;
}

export interface UpdateCostCenterInput {
  name?: string;
}

export function listCostCenters(): Promise<{ data: CostCenterRecord[] }> {
  return apiFetch("/cost-centers");
}

export function createCostCenter(input: CreateCostCenterInput): Promise<CostCenterRecord> {
  return apiFetch("/cost-centers", { method: "POST", body: input });
}

export function updateCostCenter(id: string, input: UpdateCostCenterInput): Promise<CostCenterRecord> {
  return apiFetch(`/cost-centers/${id}`, { method: "PATCH", body: input });
}

export function deactivateCostCenter(id: string): Promise<CostCenterRecord> {
  return apiFetch(`/cost-centers/${id}/deactivate`, { method: "POST" });
}
