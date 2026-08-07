import { apiFetch } from "../../../lib/api-client";

export interface ExpenseCategoryRecord {
  id: string;
  code: string;
  name: string;
  accountCode: string;
  isActive: boolean;
}

export interface CreateExpenseCategoryInput {
  code: string;
  name: string;
  accountCode: string;
}

export interface UpdateExpenseCategoryInput {
  name?: string;
  accountCode?: string;
}

export interface ExpenseRecord {
  id: string;
  branchId: string;
  expenseCategoryId: string;
  payeeName: string;
  description: string | null;
  date: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  costCenterId: string | null;
  status: string;
  journalEntryId: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface CreateExpenseInput {
  branchId: string;
  expenseCategoryId: string;
  payeeName: string;
  description?: string;
  date: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  costCenterId?: string;
}

export function listExpenseCategories(): Promise<{ data: ExpenseCategoryRecord[] }> {
  return apiFetch("/expense-categories");
}

export function createExpenseCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategoryRecord> {
  return apiFetch("/expense-categories", { method: "POST", body: input });
}

export function updateExpenseCategory(id: string, input: UpdateExpenseCategoryInput): Promise<ExpenseCategoryRecord> {
  return apiFetch(`/expense-categories/${id}`, { method: "PATCH", body: input });
}

export function deactivateExpenseCategory(id: string): Promise<ExpenseCategoryRecord> {
  return apiFetch(`/expense-categories/${id}/deactivate`, { method: "POST" });
}

export function listExpenses(): Promise<{ data: ExpenseRecord[] }> {
  return apiFetch("/expenses");
}

export function createExpense(input: CreateExpenseInput): Promise<ExpenseRecord> {
  return apiFetch("/expenses", { method: "POST", body: input });
}

export function cancelExpense(id: string): Promise<ExpenseRecord> {
  return apiFetch(`/expenses/${id}/cancel`, { method: "POST" });
}
