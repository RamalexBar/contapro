import { apiFetch } from "../../../lib/api-client";

export type ProfitabilityGroupBy = "product" | "category" | "customer";

export interface ProfitabilityRow {
  key: string;
  name: string;
  code: string | null;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number | null;
}

export interface ProfitabilityReport {
  from: string;
  to: string;
  groupBy: ProfitabilityGroupBy;
  rows: ProfitabilityRow[];
  totals: Omit<ProfitabilityRow, "key" | "name" | "code">;
  estimatedCostLines: number;
}

export function getProfitability(params: { from: string; to: string; groupBy: ProfitabilityGroupBy; branchId?: string }): Promise<ProfitabilityReport> {
  const query = new URLSearchParams({ from: params.from, to: params.to, groupBy: params.groupBy });
  if (params.branchId) query.set("branchId", params.branchId);
  return apiFetch(`/reports/profitability?${query.toString()}`);
}

export interface ValuationRow {
  productId: string;
  sku: string;
  name: string;
  categoryName: string | null;
  unit: string;
  branchId: string;
  branchName: string;
  quantity: number;
  value: number;
  unitCost: number;
  layers: Array<{ quantity: number; unitCost: number; value: number; enteredAt: string; batchNumber: string }>;
}

export interface ValuationReport {
  rows: ValuationRow[];
  totalQuantity: number;
  totalValue: number;
}

export function getInventoryValuation(branchId?: string): Promise<ValuationReport> {
  return apiFetch(`/stock/valuation${branchId ? `?branchId=${branchId}` : ""}`);
}

export interface StockAlertRow {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  branchId: string;
  branchName: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  status: "OUT_OF_STOCK" | "BELOW_MIN";
  suggestedOrder: number;
}

export function listStockAlerts(branchId?: string): Promise<{ data: StockAlertRow[] }> {
  return apiFetch(`/stock/alerts${branchId ? `?branchId=${branchId}` : ""}`);
}
