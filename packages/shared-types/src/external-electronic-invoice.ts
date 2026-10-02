import { z } from "zod";

/**
 * POST /api/public/v1/electronic-invoices (item nuevo 2026-10-02, ver public-api/README.md): un
 * POS externo que lleva su propio inventario/catalogo le pide a Contapro SOLO la factura
 * electronica DIAN -- sin mover inventario, sin usar el catalogo de productos de Contapro, y SIN
 * generar ningun comprobante contable (la contabilidad de un POS externo sale completa del
 * cierre de turno, ver shift-close.ts -- doble contabilizacion es justo lo que se evita separando
 * estos dos endpoints).
 */

export const externalInvoiceBuyerSchema = z.object({
  documentType: z.string().min(2),
  documentNumber: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type ExternalInvoiceBuyerInput = z.infer<typeof externalInvoiceBuyerSchema>;

export const externalInvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100),
});
export type ExternalInvoiceItemInput = z.infer<typeof externalInvoiceItemSchema>;

export const registerExternalElectronicInvoiceSchema = z.object({
  branchId: z.string().uuid(),
  // Si se omite, se factura a consumidor final generico (mismo default que GenerateElectronicInvoiceUseCase
  // usa cuando una venta/factura manual no trae customerId).
  buyer: externalInvoiceBuyerSchema.optional(),
  items: z.array(externalInvoiceItemSchema).min(1),
});
export type RegisterExternalElectronicInvoiceInput = z.infer<typeof registerExternalElectronicInvoiceSchema>;
