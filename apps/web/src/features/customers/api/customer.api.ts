import { apiFetch } from "../../../lib/api-client";

export interface CustomerRecord {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
}

export interface CreateCustomerInput {
  documentType: string;
  documentNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
}

export function listCustomers(search?: string): Promise<{ data: CustomerRecord[] }> {
  return apiFetch(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
}

export function createCustomer(input: CreateCustomerInput): Promise<CustomerRecord> {
  return apiFetch("/customers", { method: "POST", body: input });
}
