import type { CreateEmployeeInput, UpdateEmployeeInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface EmployeeRecord {
  id: string;
  branchId: string;
  userId: string | null;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  position: string;
  contractType: string;
  baseSalary: number;
  hireDate: string;
  terminationDate: string | null;
  status: string;
  eps: string | null;
  arlRiskLevel: string | null;
  pensionFund: string | null;
  compensationFund: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
}

export function listEmployees(filter?: { status?: string }): Promise<{ data: EmployeeRecord[] }> {
  const query = filter?.status ? `?status=${encodeURIComponent(filter.status)}` : "";
  return apiFetch(`/employees${query}`);
}

export function createEmployee(input: CreateEmployeeInput): Promise<EmployeeRecord> {
  return apiFetch("/employees", { method: "POST", body: input });
}

export function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord> {
  return apiFetch(`/employees/${id}`, { method: "PATCH", body: input });
}

export function deactivateEmployee(id: string, terminationDate: string): Promise<EmployeeRecord> {
  return apiFetch(`/employees/${id}/deactivate`, { method: "POST", body: { terminationDate } });
}
