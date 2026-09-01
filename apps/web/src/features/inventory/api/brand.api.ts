import type { CreateBrandInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface BrandRecord {
  id: string;
  name: string;
  isActive: boolean;
}

export function listBrands(): Promise<{ data: BrandRecord[] }> {
  return apiFetch("/brands");
}

export function createBrand(input: CreateBrandInput): Promise<BrandRecord> {
  return apiFetch("/brands", { method: "POST", body: input });
}
