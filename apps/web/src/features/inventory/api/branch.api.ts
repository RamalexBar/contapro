import type { CreateBranchInput } from "@erp/shared-types";
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

export function createBranch(input: CreateBranchInput): Promise<BranchRecord> {
  return apiFetch("/branches", { method: "POST", body: input });
}
