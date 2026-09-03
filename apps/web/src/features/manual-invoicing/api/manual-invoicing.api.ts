import { apiFetch, BASE_URL } from "../../../lib/api-client";
import { useAuthStore } from "../../auth/hooks/useAuthStore";

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

/** Mismo patron que printThermalReceipt (features/pos/api/sale.api.ts): el endpoint exige el
 * token en el header Authorization, asi que no sirve un <a href> directo -- se trae el PDF como
 * blob y se abre ese blob en una pestana nueva. */
export async function openManualInvoicePdf(manualInvoiceId: string): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${BASE_URL}/electronic-invoicing/manual-invoices/${manualInvoiceId}/pdf`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error("No se pudo generar el PDF de la factura");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
