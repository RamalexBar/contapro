import type { CreateProductInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  currentPrice: number;
  currentCost: number;
  taxRate: number;
  isActive: boolean;
  barcodes: string[];
}

export function listProducts(search?: string): Promise<{ data: ProductListItem[] }> {
  return apiFetch(`/products${search ? `?search=${encodeURIComponent(search)}` : ""}`);
}

export function createProduct(input: CreateProductInput) {
  return apiFetch("/products", { method: "POST", body: input });
}

export function updateProductPrice(id: string, newPrice?: number, newCost?: number) {
  return apiFetch(`/products/${id}/price`, { method: "PATCH", body: { newPrice, newCost } });
}

export function deleteProduct(id: string) {
  return apiFetch(`/products/${id}`, { method: "DELETE" });
}
