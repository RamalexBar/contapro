import { z } from "zod";

/**
 * POST /api/public/v1/accounts-payable/:accountPayableId/payments (2026-10-02): abono del POS
 * externo a una cuenta por pagar creada por POST /public/v1/purchases. accountPayableId viaja en
 * la URL (lo devuelve la respuesta de /purchases), no en el body.
 */
export const registerExternalSupplierPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(2),
});
export type RegisterExternalSupplierPaymentInput = z.infer<typeof registerExternalSupplierPaymentSchema>;
