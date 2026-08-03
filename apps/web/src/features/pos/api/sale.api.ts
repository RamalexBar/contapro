import type { AuthorizeDiscountInput, CreateSaleInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface SaleResponse {
  id: string;
  number: number;
  status: string;
  total: number;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    taxPercent: number;
    discountPercent: number;
    total: number;
    requiresDiscountAuthorization: boolean;
  }>;
}

export function createSale(input: CreateSaleInput): Promise<SaleResponse> {
  return apiFetch("/sales", { method: "POST", body: input });
}

export function authorizeDiscount(saleId: string, input: AuthorizeDiscountInput): Promise<SaleResponse> {
  return apiFetch(`/sales/${saleId}/authorize-discount`, { method: "POST", body: input });
}

export function getSale(saleId: string): Promise<SaleResponse> {
  return apiFetch(`/sales/${saleId}`);
}

export function listSales(): Promise<{ data: SaleResponse[] }> {
  return apiFetch("/sales");
}
