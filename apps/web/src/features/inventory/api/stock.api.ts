import type { StockAdjustInput, StockEntryInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface StockMovementRecord {
  id: string;
  productId: string;
  branchId: string;
  type: string;
  quantity: number;
  unitCost: number;
  createdAt: string;
}

export function registerStockEntry(input: StockEntryInput): Promise<StockMovementRecord> {
  return apiFetch("/stock/entries", { method: "POST", body: input });
}

export function adjustStock(input: StockAdjustInput): Promise<StockMovementRecord> {
  return apiFetch("/stock/adjustments", { method: "POST", body: input });
}

export interface TransferStockInput {
  productId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
}

export function transferStock(input: TransferStockInput): Promise<void> {
  return apiFetch("/stock/transfers", { method: "POST", body: input });
}

export interface KardexEntryRecord {
  id: string;
  branchId: string;
  productId: string;
  movementId: string;
  movementType: string;
  movementQuantity: number;
  balanceQty: number;
  balanceCost: number;
  averageCost: number;
  createdAt: string;
}

export function listKardex(filter: {
  productId: string;
  branchId?: string;
  from?: string;
  to?: string;
}): Promise<{ data: KardexEntryRecord[] }> {
  const params = new URLSearchParams({ productId: filter.productId });
  if (filter.branchId) params.set("branchId", filter.branchId);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  return apiFetch(`/kardex?${params.toString()}`);
}

export interface BranchStockRecord {
  productId: string;
  quantity: number;
  minStock: number;
  maxStock: number;
}

export function listBranchStock(branchId: string): Promise<{ data: BranchStockRecord[] }> {
  return apiFetch(`/stock/branch-stock?branchId=${branchId}`);
}
