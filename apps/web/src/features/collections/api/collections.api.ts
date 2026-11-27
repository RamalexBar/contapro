import { apiFetch, openPdfInNewTab } from "../../../lib/api-client";

export interface AccountReceivableRecord {
  id: string;
  customerId: string;
  saleId: string | null;
  manualInvoiceId: string | null;
  /** "#12" (venta del POS) o "SETP31" (factura manual). */
  documentLabel: string;
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

/** Historial de recibos de cobro (para reimprimir). */
export async function listReceivablePayments(range: { from: string; to: string }) {
  const res = await apiFetch<{ data: Array<{ id: string; paidAt: string; amount: number; method: string; status: string; customerName: string; customerDocument: string; documentLabel: string }> }>(
    `/receivable-payments?from=${range.from}&to=${range.to}`
  );
  return res.data.map((p) => ({ ...p, partyName: p.customerName, partyDocument: p.customerDocument }));
}
