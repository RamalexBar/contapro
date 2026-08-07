import { apiFetch } from "../../../lib/api-client";

export interface OpportunityItemRecord {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

export interface OpportunityRecord {
  id: string;
  branchId: string;
  customerId: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  stage: string;
  expectedValue: number;
  expectedCloseDate: string | null;
  lostReason: string | null;
  wonAt: string | null;
  lostAt: string | null;
  saleId: string | null;
  items: OpportunityItemRecord[];
  createdAt: string;
}

export interface CreateOpportunityInput {
  branchId: string;
  customerId: string;
  title: string;
  description?: string;
  expectedCloseDate?: string;
  items: { productId: string; quantity: number; unitPrice: number; discountPercent: number }[];
}

export interface CloseAsWonResult {
  opportunity: OpportunityRecord;
  sale: { id: string; number: number; status: string; total: number };
}

export function listOpportunities(stage?: string): Promise<{ data: OpportunityRecord[] }> {
  return apiFetch(`/opportunities${stage ? `?stage=${encodeURIComponent(stage)}` : ""}`);
}

export function createOpportunity(input: CreateOpportunityInput): Promise<OpportunityRecord> {
  return apiFetch("/opportunities", { method: "POST", body: input });
}

export function updateOpportunityStage(id: string, input: { stage: string; lostReason?: string }): Promise<OpportunityRecord> {
  return apiFetch(`/opportunities/${id}/stage`, { method: "PATCH", body: input });
}

export function closeOpportunityAsWon(id: string, paymentMethod?: "CASH" | "CREDIT"): Promise<CloseAsWonResult> {
  return apiFetch(`/opportunities/${id}/win`, { method: "POST", body: { paymentMethod } });
}
