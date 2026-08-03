import { z } from "zod";

export const createReturnSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().min(3),
  refundMethod: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT_TO_ACCOUNT"]),
  items: z
    .array(
      z.object({
        saleItemId: z.string().uuid(),
        quantity: z.number().positive(),
        restockedToBranch: z.boolean().default(true),
      })
    )
    .min(1),
});

export const listReturnsQuerySchema = z.object({
  saleId: z.string().uuid().optional(),
});
