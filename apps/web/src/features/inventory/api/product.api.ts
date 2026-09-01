import type { CreateProductInput, UpdateProductInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  currentPrice: number;
  currentCost: number;
  taxRate: number;
  isActive: boolean;
  barcodes: string[];
}

// No extiende ProductListItem: GET /products/:id (ProductResponseDto en el backend) nunca
// devuelve `barcodes` -- esa lista solo viene en GET /products (join agregado en el listado).
export interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  unit: string;
  currentCost: number;
  currentPrice: number;
  taxRate: number;
  isActive: boolean;
}

export function listProducts(search?: string): Promise<{ data: ProductListItem[] }> {
  return apiFetch(`/products${search ? `?search=${encodeURIComponent(search)}` : ""}`);
}

export function getProduct(id: string): Promise<ProductDetail> {
  return apiFetch(`/products/${id}`);
}

export function createProduct(input: CreateProductInput) {
  return apiFetch("/products", { method: "POST", body: input });
}

export function updateProduct(id: string, input: UpdateProductInput) {
  return apiFetch(`/products/${id}`, { method: "PATCH", body: input });
}

export function updateProductPrice(id: string, newPrice?: number, newCost?: number) {
  return apiFetch(`/products/${id}/price`, { method: "PATCH", body: { newPrice, newCost } });
}

export function updateProductBarcode(id: string, code: string, type = "EAN13"): Promise<void> {
  return apiFetch(`/products/${id}/barcode`, { method: "PATCH", body: { code, type } });
}

export function deleteProduct(id: string) {
  return apiFetch(`/products/${id}`, { method: "DELETE" });
}
