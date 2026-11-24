import { z } from "zod";

export const createDebitNoteSchema = z.object({
  saleId: z.string().uuid(),
  conceptCode: z.enum(["1", "2", "3", "4"]),
  reason: z.string().trim().min(3).max(500),
  amount: z.number().positive(),
});
