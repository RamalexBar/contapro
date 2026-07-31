import { apiFetch } from "../../../lib/api-client";

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
}

export interface CreateSupplierInput {
  name: string;
  nit: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  isObligatedToInvoice?: boolean;
}

export interface PurchaseRecord {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: string;
  createdAt: string;
  accountPayableId: string;
  dueDate: string;
  journalEntryId: string | null;
}

export interface CreatePurchaseInput {
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  dueDate: string;
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

export function createPurchase(input: CreatePurchaseInput): Promise<PurchaseRecord> {
  return apiFetch("/purchases", { method: "POST", body: input });
}

export function cancelPurchase(id: string): Promise<PurchaseRecord> {
  return apiFetch(`/purchases/${id}/cancel`, { method: "POST" });
}

export function listAccountsPayable(status?: string): Promise<{ data: AccountPayableRecord[] }> {
  return apiFetch(`/accounts-payable${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}

export function registerSupplierPayment(
  accountPayableId: string,
  input: { amount: number; method: string }
): Promise<{ payment: unknown; accountPayable: AccountPayableRecord }> {
  return apiFetch(`/accounts-payable/${accountPayableId}/payments`, { method: "POST", body: input });
}
