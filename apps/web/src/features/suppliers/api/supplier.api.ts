import { apiFetch, openPdfInNewTab } from "../../../lib/api-client";

export interface SupplierRecord {
  id: string;
  name: string;
  nit: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  isObligatedToInvoice: boolean;
  documentType: string;
  municipalityCode: string | null;
}

export interface CreateSupplierInput {
  name: string;
  nit: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  isObligatedToInvoice?: boolean;
  documentType?: string;
  municipalityCode?: string;
}

export interface PurchaseRecord {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  retentionTotal: number;
  status: string;
  createdAt: string;
  accountPayableId: string;
  dueDate: string;
  journalEntryId: string | null;
  currency: string;
  exchangeRate: number;
  foreignTotal: number | null;
}

export interface PurchaseWithholdingInput {
  withholdingConceptId: string;
  base: number;
}

export interface CreatePurchaseInput {
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  dueDate: string;
  withholdings: PurchaseWithholdingInput[];
  currency?: string;
  exchangeRate?: number;
  /** Renglones que entran al inventario con la compra -- sin esto, la compra solo se contabiliza. */
  items?: PurchaseItemInput[];
}

export interface PurchaseItemInput {
  productId?: string;
  newProduct?: { name: string; salePrice: number; taxRate?: number; barcode?: string };
  quantity: number;
  unitCost: number;
}

export interface AccountPayableRecord {
  id: string;
  supplierId: string;
  purchaseId: string;
  branchId: string;
  amount: number;
  balance: number;
  dueDate: string;
  status: string;
}

export function listSuppliers(search?: string): Promise<{ data: SupplierRecord[] }> {
  return apiFetch(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
}

export function createSupplier(input: CreateSupplierInput): Promise<SupplierRecord> {
  return apiFetch("/suppliers", { method: "POST", body: input });
}

export function listPurchases(): Promise<{ data: PurchaseRecord[] }> {
  return apiFetch("/purchases");
}

export function createPurchase(
  input: CreatePurchaseInput
): Promise<PurchaseRecord & { goodsReceiptId: string | null; createdProductIds: string[] }> {
  return apiFetch("/purchases", { method: "POST", body: input });
}

export interface ExtractedPurchaseInvoice {
  supplierName: string | null;
  supplierNit: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  subtotal: number | null;
  taxTotal: number | null;
  total: number | null;
  currency: string;
  items: ExtractedInvoiceLine[];
  warnings: string[];
}

export interface ExtractedInvoiceLine {
  description: string;
  code: string | null;
  quantity: number | null;
  unitPrice: number | null;
  taxRate: number | null;
  lineTotal: number | null;
}

export interface ExtractPurchaseInvoiceResult {
  extracted: ExtractedPurchaseInvoice;
  matchedSupplier: { id: string; name: string; nit: string } | null;
  suggestedDueDate: string | null;
  lines: Array<ExtractedInvoiceLine & { matchedProduct: { id: string; name: string; sku: string } | null }>;
}

export function extractPurchaseInvoice(fileBase64: string, mediaType: string): Promise<ExtractPurchaseInvoiceResult> {
  return apiFetch("/purchases/extract", { method: "POST", body: { fileBase64, mediaType } });
}

export function cancelPurchase(id: string): Promise<PurchaseRecord> {
  return apiFetch(`/purchases/${id}/cancel`, { method: "POST" });
}

export function listAccountsPayable(status?: string): Promise<{ data: AccountPayableRecord[] }> {
  return apiFetch(`/accounts-payable${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}

export interface SupplierPaymentRecord {
  id: string;
  accountPayableId: string;
  amount: number;
  method: string;
  status: "REGISTERED" | "REVERSED";
  paidAt: string;
}

export function registerSupplierPayment(
  accountPayableId: string,
  input: { amount: number; method: string }
): Promise<{ payment: SupplierPaymentRecord; accountPayable: AccountPayableRecord }> {
  return apiFetch(`/accounts-payable/${accountPayableId}/payments`, { method: "POST", body: input });
}

export function printSupplierPaymentPdf(paymentId: string): Promise<void> {
  return openPdfInNewTab(`/supplier-payments/${paymentId}/pdf`);
}
