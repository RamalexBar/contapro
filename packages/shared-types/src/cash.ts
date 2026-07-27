import { z } from "zod";

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().uuid(),
  openingAmount: z.number().nonnegative(),
});
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const cashCountInputSchema = z.object({
  denomination: z.number().positive(),
  quantity: z.number().int().nonnegative(),
});
export type CashCountInput = z.infer<typeof cashCountInputSchema>;

export const closeCashSessionSchema = z.object({
  closingAmountCounted: z.number().nonnegative(),
  counts: z.array(cashCountInputSchema).optional(),
  notes: z.string().optional(),
});
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

export const cashMovementSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "WITHDRAWAL", "DEPOSIT"]),
  amount: z.number().positive(),
  concept: z.string().min(1),
});
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
