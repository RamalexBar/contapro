import { apiFetch } from "../../../lib/api-client";

export interface CustomerRecord {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
  priceListId: string | null;
  municipalityCode: string | null;
}

export interface CreateCustomerInput {
  documentType: string;
  documentNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  priceListId?: string;
  municipalityCode?: string;
}

export function listCustomers(search?: string): Promise<{ data: CustomerRecord[] }> {
  return apiFetch(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
}

export function createCustomer(input: CreateCustomerInput): Promise<CustomerRecord> {
  return apiFetch("/customers", { method: "POST", body: input });
}

export function updateCustomerPriceList(id: string, priceListId: string | null): Promise<CustomerRecord> {
  return apiFetch(`/customers/${id}/price-list`, { method: "PATCH", body: { priceListId } });
}
