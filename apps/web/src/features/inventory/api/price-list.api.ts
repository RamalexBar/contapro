import { apiFetch } from "../../../lib/api-client";

export interface PriceListRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreatePriceListInput {
  code: string;
  name: string;
}

export interface UpdatePriceListInput {
  name?: string;
}

export interface ProductPriceRecord {
  productId: string;
  price: number;
}

export function listPriceLists(): Promise<{ data: PriceListRecord[] }> {
  return apiFetch("/price-lists");
}

export function createPriceList(input: CreatePriceListInput): Promise<PriceListRecord> {
  return apiFetch("/price-lists", { method: "POST", body: input });
}

export function updatePriceList(id: string, input: UpdatePriceListInput): Promise<PriceListRecord> {
  return apiFetch(`/price-lists/${id}`, { method: "PATCH", body: input });
}

export function deactivatePriceList(id: string): Promise<PriceListRecord> {
  return apiFetch(`/price-lists/${id}/deactivate`, { method: "POST" });
}

export function listProductPrices(priceListId: string): Promise<{ data: ProductPriceRecord[] }> {
  return apiFetch(`/price-lists/${priceListId}/prices`);
}

export function setProductPrice(priceListId: string, productId: string, price: number): Promise<ProductPriceRecord> {
  return apiFetch(`/price-lists/${priceListId}/products/${productId}/price`, { method: "PUT", body: { price } });
}

export function removeProductPrice(priceListId: string, productId: string): Promise<void> {
  return apiFetch(`/price-lists/${priceListId}/products/${productId}/price`, { method: "DELETE" });
}
