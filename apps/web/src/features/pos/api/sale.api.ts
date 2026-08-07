import type { AuthorizeDiscountInput, CreateSaleInput } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface SaleResponse {
  id: string;
  number: number;
  status: string;
  customerId: string | null;
  total: number;
  currency: string;
  exchangeRate: number;
  foreignTotal: number | null;
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

export interface WhatsAppDeliveryRecord {
  id: string;
  messageType: string;
  recipientPhone: string;
  success: boolean;
  errorMessage: string | null;
  sentAt: string;
}

export function listSaleWhatsAppDeliveries(saleId: string): Promise<{ data: WhatsAppDeliveryRecord[] }> {
  return apiFetch(`/electronic-invoicing/sales/${saleId}/whatsapp-deliveries`);
}

export function resendSaleWhatsApp(saleId: string): Promise<void> {
  return apiFetch(`/electronic-invoicing/sales/${saleId}/whatsapp/resend`, { method: "POST" });
}
