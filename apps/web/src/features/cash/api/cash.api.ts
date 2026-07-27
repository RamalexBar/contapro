import type { CashMovementInput, CloseCashSessionInput, OpenCashSessionInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface CashSessionResponse {
  id: string;
  status: string;
  openingAmount: number;
  closingAmountExpected: number | null;
  closingAmountCounted: number | null;
  difference: number | null;
  openedAt: string;
}

export interface CashRegister {
  id: string;
  code: string;
  name: string;
}

export function listCashRegisters(): Promise<{ data: CashRegister[] }> {
  return apiFetch("/cash/registers");
}

export function getActiveSession(cashRegisterId: string): Promise<CashSessionResponse | null> {
  return apiFetch(`/cash/registers/${cashRegisterId}/active-session`);
}

export function openSession(input: OpenCashSessionInput): Promise<CashSessionResponse> {
  return apiFetch("/cash/sessions/open", { method: "POST", body: input });
}

export function closeSession(sessionId: string, input: CloseCashSessionInput): Promise<CashSessionResponse> {
  return apiFetch(`/cash/sessions/${sessionId}/close`, { method: "POST", body: input });
}

export function registerCashMovement(sessionId: string, input: CashMovementInput) {
  return apiFetch(`/cash/sessions/${sessionId}/movements`, { method: "POST", body: input });
}
