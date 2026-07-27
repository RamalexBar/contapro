import { z } from "zod";

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

export const createSaleSchema = z.object({
  branchId: z.string().uuid(),
  cashSessionId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemInputSchema).min(1),
  payments: z.array(salePaymentInputSchema).min(1),
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
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export type SaleStatus =
  | "DRAFT"
  | "PENDING_AUTHORIZATION"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED_PARTIAL"
  | "RETURNED_FULL";
