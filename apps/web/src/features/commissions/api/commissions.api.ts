import { apiFetch } from "../../../lib/api-client";

export interface SalesCommissionSchemeRecord {
  id: string;
  sellerUserId: string;
  ratePercent: number;
  isActive: boolean;
}

export interface SellerRecord {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
}

export type CommissionSettlementStatus = "CALCULATED" | "PAID";

export interface CommissionSettlementRecord {
  id: string;
  sellerUserId: string;
  year: number;
  month: number;
  salesBase: number;
  ratePercent: number;
  commissionAmount: number;
  status: CommissionSettlementStatus;
  calculatedAt: string;
  paidAt: string | null;
  journalEntryId: string | null;
}

export function listCommissionSchemes(): Promise<{ data: SalesCommissionSchemeRecord[] }> {
  return apiFetch("/commission-schemes");
}

export function createCommissionScheme(input: { sellerUserId: string; ratePercent: number }): Promise<SalesCommissionSchemeRecord> {
  return apiFetch("/commission-schemes", { method: "POST", body: input });
}

export function deactivateCommissionScheme(id: string): Promise<SalesCommissionSchemeRecord> {
  return apiFetch(`/commission-schemes/${id}/deactivate`, { method: "POST" });
}

export function listSellers(): Promise<{ data: SellerRecord[] }> {
  return apiFetch("/commissions/sellers");
}

export function calculateCommissions(year: number, month: number): Promise<{ data: CommissionSettlementRecord[] }> {
  return apiFetch("/commissions/calculate", { method: "POST", body: { year, month } });
}

export function listCommissionSettlements(filter?: {
  year?: number;
  month?: number;
  status?: string;
}): Promise<{ data: CommissionSettlementRecord[] }> {
  const params = new URLSearchParams();
  if (filter?.year) params.set("year", String(filter.year));
  if (filter?.month) params.set("month", String(filter.month));
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return apiFetch(`/commissions/settlements${qs ? `?${qs}` : ""}`);
}

export function payCommissionSettlement(
  id: string,
  input: { branchId: string; paymentMethod: string }
): Promise<CommissionSettlementRecord> {
  return apiFetch(`/commissions/settlements/${id}/pay`, { method: "POST", body: input });
}
