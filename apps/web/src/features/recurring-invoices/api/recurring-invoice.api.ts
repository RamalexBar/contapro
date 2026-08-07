import { apiFetch } from "../../../lib/api-client";

export interface RecurringInvoiceItemRecord {
  productId: string;
  quantity: number;
}

export interface RecurringInvoiceRecord {
  id: string;
  customerId: string;
  branchId: string;
  name: string;
  dayOfMonth: number;
  priceListId: string | null;
  dueDays: number;
  isActive: boolean;
  nextRunDate: string;
  lastRunDate: string | null;
  items: RecurringInvoiceItemRecord[];
  createdAt: string;
}

export interface CreateRecurringInvoiceInput {
  customerId: string;
  branchId: string;
  name: string;
  dayOfMonth: number;
  priceListId?: string;
  dueDays: number;
  items: RecurringInvoiceItemRecord[];
}

export interface RecurringInvoiceRunRecord {
  id: string;
  recurringInvoiceId: string;
  runDate: string;
  status: "SUCCESS" | "FAILED";
  saleId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export function listRecurringInvoices(): Promise<{ data: RecurringInvoiceRecord[] }> {
  return apiFetch("/recurring-invoices");
}

export function createRecurringInvoice(input: CreateRecurringInvoiceInput): Promise<RecurringInvoiceRecord> {
  return apiFetch("/recurring-invoices", { method: "POST", body: input });
}

export function deactivateRecurringInvoice(id: string): Promise<RecurringInvoiceRecord> {
  return apiFetch(`/recurring-invoices/${id}/deactivate`, { method: "POST" });
}

export function listRecurringInvoiceRuns(id: string): Promise<{ data: RecurringInvoiceRunRecord[] }> {
  return apiFetch(`/recurring-invoices/${id}/runs`);
}
