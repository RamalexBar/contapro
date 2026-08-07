import { apiFetch } from "../../../lib/api-client";

export interface FixedAssetRecord {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  accumulatedDepreciation: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateFixedAssetInput {
  branchId: string;
  name: string;
  description?: string;
  purchaseDate: string;
  cost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
}

export type DepreciationEntryStatus = "CALCULATED" | "POSTED";

export interface DepreciationEntryRecord {
  id: string;
  fixedAssetId: string;
  year: number;
  month: number;
  amount: number;
  status: DepreciationEntryStatus;
  calculatedAt: string;
  postedAt: string | null;
  journalEntryId: string | null;
}

export function listFixedAssets(): Promise<{ data: FixedAssetRecord[] }> {
  return apiFetch("/fixed-assets");
}

export function createFixedAsset(input: CreateFixedAssetInput): Promise<FixedAssetRecord> {
  return apiFetch("/fixed-assets", { method: "POST", body: input });
}

export function deactivateFixedAsset(id: string): Promise<FixedAssetRecord> {
  return apiFetch(`/fixed-assets/${id}/deactivate`, { method: "POST" });
}

export function calculateDepreciation(year: number, month: number): Promise<{ data: DepreciationEntryRecord[] }> {
  return apiFetch("/depreciation/calculate", { method: "POST", body: { year, month } });
}

export function listDepreciationEntries(filter?: {
  year?: number;
  month?: number;
  status?: string;
}): Promise<{ data: DepreciationEntryRecord[] }> {
  const params = new URLSearchParams();
  if (filter?.year) params.set("year", String(filter.year));
  if (filter?.month) params.set("month", String(filter.month));
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return apiFetch(`/depreciation/entries${qs ? `?${qs}` : ""}`);
}

export function postDepreciationEntry(id: string): Promise<DepreciationEntryRecord> {
  return apiFetch(`/depreciation/entries/${id}/post`, { method: "POST" });
}
