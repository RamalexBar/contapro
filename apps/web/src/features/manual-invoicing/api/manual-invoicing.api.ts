import { apiFetch, openPdfInNewTab } from "../../../lib/api-client";

export interface ManualInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface ManualInvoiceRecord {
  id: string;
  branchId: string;
  customerId: string | null;
  createdByUserId: string;
  issueDate: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  cufe: string | null;
  invoiceXmlUrl: string | null;
  createdAt: string;
  items: ManualInvoiceItem[];
}

export interface CreateManualInvoiceInput {
  branchId: string;
  customerId?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; taxPercent: number }>;
}

export function listManualInvoices(): Promise<{ data: ManualInvoiceRecord[] }> {
  return apiFetch("/manual-invoices");
}

export function createManualInvoice(input: CreateManualInvoiceInput): Promise<ManualInvoiceRecord> {
  return apiFetch("/manual-invoices", { method: "POST", body: input });
}

export interface ManualInvoiceElectronicStatus {
  id: string;
  fullNumber: string;
  cufe: string;
  status: string;
  rejectionReason?: string | null;
}

export function getManualInvoiceElectronicStatus(manualInvoiceId: string): Promise<ManualInvoiceElectronicStatus> {
  return apiFetch(`/electronic-invoicing/manual-invoices/${manualInvoiceId}`);
}

export function openManualInvoicePdf(manualInvoiceId: string): Promise<void> {
  return openPdfInNewTab(`/electronic-invoicing/manual-invoices/${manualInvoiceId}/pdf`);
}
