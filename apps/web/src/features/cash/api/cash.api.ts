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
  closedAt: string | null;
  openedByUserId: string;
  closedByUserId: string | null;
}

export interface CashRegister {
  id: string;
  code: string;
  name: string;
}

export function listCashRegisters(): Promise<{ data: CashRegister[] }> {
  return apiFetch("/cash/registers");
}

/** Sesion abierta + cuanto deberia haber en caja ahora (base + entradas - salidas de efectivo). */
export type ActiveCashSessionResponse = CashSessionResponse & { expectedAmount: number; openedByName: string | null };

export type CashSessionHistoryItem = CashSessionResponse & { openedByName: string | null; closedByName: string | null };

/** Ultimos turnos de la caja, el mas reciente primero. */
export function listCashSessions(cashRegisterId: string): Promise<{ data: CashSessionHistoryItem[] }> {
  return apiFetch(`/cash/registers/${cashRegisterId}/sessions`);
}

export function getActiveSession(cashRegisterId: string): Promise<ActiveCashSessionResponse | null> {
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
