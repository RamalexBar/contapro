import { z } from "zod";

/**
 * POST /api/public/v1/supplier-payments (2026-10-02): abono del POS externo a una cuenta por
 * pagar creada por POST /public/v1/purchases (crédito). Requiere el header `Idempotency-Key` (id
 * propio del abono en el POS), igual criterio que /purchases y /shift-closes.
 */
export const registerExternalSupplierPaymentSchema = z.object({
  accountPayableId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string().min(2),
});
export type RegisterExternalSupplierPaymentInput = z.infer<typeof registerExternalSupplierPaymentSchema>;
