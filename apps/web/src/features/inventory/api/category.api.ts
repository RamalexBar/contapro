import type { CreateCategoryInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface CategoryRecord {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

export function listCategories(): Promise<{ data: CategoryRecord[] }> {
  return apiFetch("/categories");
}

export function createCategory(input: CreateCategoryInput): Promise<CategoryRecord> {
  return apiFetch("/categories", { method: "POST", body: input });
}
