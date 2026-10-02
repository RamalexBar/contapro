import { z } from "zod";

/**
 * POST /api/public/v1/purchases (2026-10-02, ver public-api/README.md): el POS externo registra
 * una compra a un proveedor (recepcion de mercancia al costo + cuenta por pagar), identificando
 * al proveedor por NIT -- no conoce el id interno de Contapro, se resuelve/crea igual que el
 * comprador en external-electronic-invoice.ts. Sin lineas de producto: el POS no usa el catalogo
 * de Contapro (no lleva inventario aqui), solo los totales de la factura del proveedor, igual que
 * CreatePurchaseUseCase ya exige para el flujo interno.
 */

export const externalPurchaseSupplierSchema = z.object({
  nit: z.string().min(3),
  name: z.string().min(2),
  documentType: z.string().min(2).optional(),
  isObligatedToInvoice: z.boolean().optional(),
});
export type ExternalPurchaseSupplierInput = z.infer<typeof externalPurchaseSupplierSchema>;

export const registerExternalPurchaseSchema = z
  .object({
    branchId: z.string().uuid(),
    supplier: externalPurchaseSupplierSchema,
    invoiceNumber: z.string().min(1),
    subtotal: z.number().nonnegative(),
    taxTotal: z.number().nonnegative(),
    total: z.number().nonnegative(),
    dueDate: z.coerce.date(),
    currency: z.string().length(3).toUpperCase().default("COP"),
    exchangeRate: z.number().positive().default(1),
  })
  .refine((v) => v.currency === "COP" || v.exchangeRate !== 1, {
    message: "exchangeRate es obligatorio cuando currency no es COP",
    path: ["exchangeRate"],
  });
export type RegisterExternalPurchaseInput = z.infer<typeof registerExternalPurchaseSchema>;
