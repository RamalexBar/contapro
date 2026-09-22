import type { AuthorizeDiscountInput, CreateSaleInput } from "@erp/shared-types";
import { apiFetch, ApiError, openPdfInNewTab } from "../../../lib/api-client";

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

export interface ElectronicInvoiceStatus {
  status: "GENERATED" | "PENDING_SIGNATURE" | "PENDING_SUBMISSION" | "ACCEPTED" | "REJECTED";
  fullNumber: string;
  rejectionReason: string | null;
}

/** null = la venta todavia no tiene factura electronica generada (404), en vez de tratarlo como
 * un error -- es el estado normal para una venta recien creada o para consumidor final. */
export async function getElectronicInvoiceBySale(saleId: string): Promise<ElectronicInvoiceStatus | null> {
  try {
    return await apiFetch(`/electronic-invoicing/sales/${saleId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
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
 * termica de mostrador instalada como impresora del sistema operativo.
 */
export function printThermalReceipt(saleId: string): Promise<void> {
  return openPdfInNewTab(`/electronic-invoicing/sales/${saleId}/pdf?format=thermal`);
}
