import { z } from "zod";

export const registerReceivablePaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
});
export type RegisterReceivablePaymentInput = z.infer<typeof registerReceivablePaymentSchema>;

export const createReceivableCheckoutSchema = z.object({
  redirectUrl: z.string().url().optional(),
});
export type CreateReceivableCheckoutInput = z.infer<typeof createReceivableCheckoutSchema>;
