import type { AuthorizeDiscountInput, CreateSaleInput } from "@erp/shared-types";
import { apiFetch, BASE_URL } from "../../../lib/api-client";
import { useAuthStore } from "../../auth/hooks/useAuthStore";

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

/**
 * Abre en una pestana nueva la tirilla termica (80mm) de la venta, lista para imprimir desde el
 * navegador (Ctrl+P / icono de impresora del lector de PDF) en cualquier impresora, incluida una
 * termica de mostrador instalada como impresora del sistema operativo. La URL del endpoint exige
 * el token en el header Authorization, asi que no sirve un <a href> directo -- se trae el PDF
 * como blob (mismo patron que downloadPayslipPdf) y se abre ese blob, en vez de descargarlo.
 */
export async function printThermalReceipt(saleId: string): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${BASE_URL}/electronic-invoicing/sales/${saleId}/pdf?format=thermal`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error("No se pudo generar la tirilla para imprimir");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // No se revoca de inmediato: la pestana nueva todavia tiene que cargar el blob de forma
  // asincrona. Se libera igual, solo que despues, en vez de dejarlo colgado indefinidamente.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
