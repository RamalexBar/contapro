import { z } from "zod";

export const createDebitNoteSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  reason: z.string().min(3),
  amount: z.number().positive(),
});
