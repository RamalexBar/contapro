import { apiFetch } from "../../../lib/api-client";

export type RefundMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT_TO_ACCOUNT";

export interface ReturnItemInput {
  saleItemId: string;
  quantity: number;
  restockedToBranch: boolean;
}

export interface CreateReturnInput {
  saleId: string;
  reason: string;
  refundMethod: RefundMethod;
  items: ReturnItemInput[];
}

export interface ReturnRecord {
  id: string;
  saleId: string;
  reason: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: string;
    saleItemId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    restockedToBranch: boolean;
  }>;
}

export function listReturns(saleId?: string): Promise<{ data: ReturnRecord[] }> {
  return apiFetch(`/returns${saleId ? `?saleId=${saleId}` : ""}`);
}

export function createReturn(input: CreateReturnInput): Promise<ReturnRecord> {
  return apiFetch("/returns", { method: "POST", body: input });
}
