import { apiFetch, openPdfInNewTab } from "../../../lib/api-client";

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

export interface AccountReceivablePaymentRecord {
  id: string;
  accountReceivableId: string;
  amount: number;
  method: string;
  status: "PENDING" | "REGISTERED" | "FAILED";
  reference: string | null;
  paidAt: string;
}

export function registerReceivablePayment(
  accountReceivableId: string,
  input: { amount: number; method: string }
): Promise<{ payment: AccountReceivablePaymentRecord; accountReceivable: AccountReceivableRecord }> {
  return apiFetch(`/accounts-receivable/${accountReceivableId}/payments`, { method: "POST", body: input });
}

export function printReceivablePaymentPdf(paymentId: string): Promise<void> {
  return openPdfInNewTab(`/receivable-payments/${paymentId}/pdf`);
}

export function createReceivableCheckout(accountReceivableId: string): Promise<{ checkoutUrl: string; reference: string; amount: number }> {
  return apiFetch(`/accounts-receivable/${accountReceivableId}/checkout`, { method: "POST", body: {} });
}
