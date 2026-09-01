import { apiFetch } from "../../../lib/api-client";

export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}

export function listBranches(): Promise<{ data: BranchRecord[] }> {
  return apiFetch("/branches");
}
