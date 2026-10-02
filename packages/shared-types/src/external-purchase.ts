import { z } from "zod";

/**
 * POST /api/public/v1/purchases (2026-10-02, ver public-api/README.md): el POS externo registra
 * una compra a un proveedor (recepcion de mercancia o servicio al costo + cuenta por pagar),
 * identificando al proveedor por NIT+DV -- no conoce el id interno de Contapro, se resuelve/crea
 * igual que el comprador en external-electronic-invoice.ts. Sin lineas de producto: el POS no usa
 * el catalogo de Contapro (no lleva inventario aqui), solo el desglose de IVA por tarifa y el
 * total, igual que CreatePurchaseUseCase ya exige para el flujo interno.
 */

export const externalPurchaseSupplierSchema = z.object({
  nit: z.string().min(3),
  // Digito de verificacion -- se valida contra el NIT (calculateNitCheckDigit) antes de
  // resolver/crear el proveedor, para atrapar errores de digitacion del lado del POS.
  dv: z.number().int().min(0).max(9),
  name: z.string().min(2),
  documentType: z.string().min(2).optional(),
  isObligatedToInvoice: z.boolean().optional(),
});
export type ExternalPurchaseSupplierInput = z.infer<typeof externalPurchaseSupplierSchema>;

export const externalPurchaseTaxLineSchema = z.object({
  taxRate: z.number().min(0).max(100),
  taxableBase: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
});
export type ExternalPurchaseTaxLineInput = z.infer<typeof externalPurchaseTaxLineSchema>;

// "contado": se paga de una vez (Caja o Bancos segun `method`) en el mismo llamado -- dos
// comprobantes (compra + abono total), mismo efecto neto que un pago de contado real. "credito":
// queda como cuenta por pagar con la fecha de vencimiento indicada, sin pago todavia.
export const externalPurchaseCashPaymentSchema = z.object({ term: z.literal("CASH"), method: z.string().min(2) });
export const externalPurchaseCreditPaymentSchema = z.object({ term: z.literal("CREDIT"), dueDate: z.coerce.date() });
export const externalPurchasePaymentSchema = z.discriminatedUnion("term", [
  externalPurchaseCashPaymentSchema,
  externalPurchaseCreditPaymentSchema,
]);
export type ExternalPurchasePaymentInput = z.infer<typeof externalPurchasePaymentSchema>;

export const registerExternalPurchaseSchema = z
  .object({
    branchId: z.string().uuid(),
    supplier: externalPurchaseSupplierSchema,
    invoiceNumber: z.string().min(1),
    // Fecha real de la factura del proveedor (no necesariamente "hoy" -- el POS puede sincronizar
    // la recepcion dias despues), usada como fecha del comprobante contable.
    invoiceDate: z.coerce.date(),
    taxBreakdown: z.array(externalPurchaseTaxLineSchema).min(1),
    total: z.number().positive(),
    // Si se omite, se contabiliza como mercancia (Inventario, 1435) -- igual que siempre. Si se
    // manda, debe ser el `code` de una categoria de gasto YA configurada por el contador (mismo
    // mecanismo que POST /expenses) y se usa su cuenta en vez de Inventario (compra de servicio).
    expenseCategoryCode: z.string().min(1).optional(),
    payment: externalPurchasePaymentSchema,
    currency: z.string().length(3).toUpperCase().default("COP"),
    exchangeRate: z.number().positive().default(1),
  })
  .refine((v) => v.currency === "COP" || v.exchangeRate !== 1, {
    message: "exchangeRate es obligatorio cuando currency no es COP",
    path: ["exchangeRate"],
  });
export type RegisterExternalPurchaseInput = z.infer<typeof registerExternalPurchaseSchema>;
