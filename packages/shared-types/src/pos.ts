import { z } from "zod";
import { withholdingApplicationSchema } from "./accounting";

export const saleItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  discountPercent: z.number().min(0).max(100).default(0),
});
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const salePaymentInputSchema = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT", "MIXED"]),
  amount: z.number().positive(),
  reference: z.string().optional(),
});
export type SalePaymentInput = z.infer<typeof salePaymentInputSchema>;

export const createSaleSchema = z
  .object({
    branchId: z.string().uuid(),
    cashSessionId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    items: z.array(saleItemInputSchema).min(1),
    payments: z.array(salePaymentInputSchema).min(1),
    withholdings: z.array(withholdingApplicationSchema).default([]),
    // Solo relevante si hay un pago method="CREDIT" (ver resolve-receivable-input.ts). Si se omite,
    // se usa el default de 30 dias.
    dueDate: z.coerce.date().optional(),
    // Multi-moneda informativa (item 33 de docs/ALCANCE.md, ver pos.prisma) -- no afecta ningun
    // calculo de subtotal/impuesto/total, que siguen siendo en COP. `exchangeRate` es la TRM
    // manual (COP por 1 unidad de `currency`).
    currency: z.string().length(3).toUpperCase().default("COP"),
    exchangeRate: z.number().positive().default(1),
    // Item 35 de docs/ALCANCE.md (listas de precios) -- fuerza una lista para esta venta puntual;
    // si se omite, se usa la lista asignada al cliente (si hay uno), o el precio base.
    priceListId: z.string().uuid().optional(),
  })
  .refine((v) => v.currency === "COP" || v.exchangeRate !== 1, {
    message: "Debes indicar la tasa de cambio (TRM) cuando la moneda no es COP",
    path: ["exchangeRate"],
  });
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

/** Requiere permiso `discount.authorize`. */
export const authorizeDiscountSchema = z
  .object({
    saleItemId: z.string().uuid(),
    authorizerUserId: z.string().uuid(),
    reason: z.string().optional(),
    pin: z.string().optional(),
    password: z.string().optional(),
  })
  .refine((v) => Boolean(v.pin) || Boolean(v.password), {
    message: "Se requiere pin o password del autorizador",
  });
export type AuthorizeDiscountInput = z.infer<typeof authorizeDiscountSchema>;

export const createQuoteSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  validUntil: z.coerce.date(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().positive(),
      discountPercent: z.number().min(0).max(100).default(0),
    })
  ).min(1),
  // Item 35 de docs/ALCANCE.md (listas de precios) -- mismo criterio que createSaleSchema.
  priceListId: z.string().uuid().optional(),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export type SaleStatus =
  | "DRAFT"
  | "PENDING_AUTHORIZATION"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED_PARTIAL"
  | "RETURNED_FULL";
