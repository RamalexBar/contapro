import { apiFetch } from "../../../lib/api-client";

export interface AccountReceivableRecord {
  id: string;
  customerId: string;
  saleId: string;
  branchId: string;
  amount: number;
  balance: number;
  dueDate: string;
  status: string;
}

export function listAccountsReceivable(status?: string): Promise<{ data: AccountReceivableRecord[] }> {
  return apiFetch(`/accounts-receivable${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}

export function registerReceivablePayment(
  accountReceivableId: string,
  input: { amount: number; method: string }
): Promise<{ payment: unknown; accountReceivable: AccountReceivableRecord }> {
  return apiFetch(`/accounts-receivable/${accountReceivableId}/payments`, { method: "POST", body: input });
}

export function createReceivableCheckout(accountReceivableId: string): Promise<{ checkoutUrl: string; reference: string; amount: number }> {
  return apiFetch(`/accounts-receivable/${accountReceivableId}/checkout`, { method: "POST", body: {} });
}
