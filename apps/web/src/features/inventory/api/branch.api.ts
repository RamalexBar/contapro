import type { CreateBranchInput, UpdateBranchInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
}

export function listBranches(): Promise<{ data: BranchRecord[] }> {
  return apiFetch("/branches");
}

/** Incluye las desactivadas (pantalla de administracion de sucursales). */
export function listAllBranches(): Promise<{ data: BranchRecord[] }> {
  return apiFetch("/branches?includeInactive=true");
}

export function updateBranch(id: string, input: UpdateBranchInput): Promise<BranchRecord> {
  return apiFetch(`/branches/${id}`, { method: "PATCH", body: input });
}

export function createBranch(input: CreateBranchInput): Promise<BranchRecord> {
  return apiFetch("/branches", { method: "POST", body: input });
}
