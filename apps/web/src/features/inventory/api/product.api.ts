import type { CreateProductInput, ImportProductsResult, UpdateProductInput } from "@erp/shared-types";
import { apiFetch, BASE_URL } from "../../../lib/api-client";

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  /** Ubicacion en la estanteria, ej. "Pasillo 3 - Estante B". */
  location: string | null;
  categoryId: string | null;
  brandId: string | null;
  currentPrice: number;
  currentCost: number;
  taxRate: number;
  isActive: boolean;
  barcodes: string[];
  /** Direccion firmada de la foto (relativa a la API), o null si no tiene. Ver productPhotoUrl. */
  photoPath: string | null;
}

// No extiende ProductListItem: GET /products/:id (ProductResponseDto en el backend) nunca
// devuelve `barcodes` -- esa lista solo viene en GET /products (join agregado en el listado).
export interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  location: string | null;
  categoryId: string | null;
  brandId: string | null;
  unit: string;
  currentCost: number;
  currentPrice: number;
  taxRate: number;
  isActive: boolean;
}

/** La foto se pide a la API (otro dominio que la web) por su direccion firmada: sirve directo en un <img>. */
export function productPhotoUrl(photoPath: string): string {
  return `${BASE_URL}${photoPath}`;
}

export function setProductPhoto(id: string, dataUrl: string): Promise<{ photoPath: string }> {
  return apiFetch(`/products/${id}/photo`, { method: "PUT", body: { dataUrl } });
}

export function removeProductPhoto(id: string): Promise<void> {
  return apiFetch(`/products/${id}/photo`, { method: "DELETE" });
}

/** Hasta 5 fotos por producto; la principal (isMain) es la que sale en el POS, la lista y la cotizacion. */
export interface ProductPhotoItem {
  id: string;
  path: string;
  isMain: boolean;
}

export function listProductPhotos(id: string): Promise<{ data: ProductPhotoItem[] }> {
  return apiFetch(`/products/${id}/photos`);
}

export function addProductPhoto(id: string, dataUrl: string): Promise<{ data: ProductPhotoItem[] }> {
  return apiFetch(`/products/${id}/photos`, { method: "POST", body: { dataUrl } });
}

export function deleteProductPhoto(id: string, photoId: string): Promise<void> {
  return apiFetch(`/products/${id}/photos/${photoId}`, { method: "DELETE" });
}

export function setMainProductPhoto(id: string, photoId: string): Promise<void> {
  return apiFetch(`/products/${id}/photos/${photoId}/main`, { method: "POST" });
}

export function listProducts(search?: string): Promise<{ data: ProductListItem[] }> {
  return apiFetch(`/products${search ? `?search=${encodeURIComponent(search)}` : ""}`);
}

export function getProduct(id: string): Promise<ProductDetail> {
  return apiFetch(`/products/${id}`);
}

export function createProduct(input: CreateProductInput) {
  return apiFetch<ProductDetail>("/products", { method: "POST", body: input });
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

export function importProducts(input: {
  rows: Record<string, unknown>[];
  rowNumbers: number[];
  pricesIncludeTax: boolean;
  dryRun: boolean;
}): Promise<ImportProductsResult> {
  return apiFetch("/products/import", { method: "POST", body: input });
}
