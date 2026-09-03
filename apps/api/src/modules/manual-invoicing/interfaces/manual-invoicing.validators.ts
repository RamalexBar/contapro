import { z } from "zod";

export const createManualInvoiceSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        taxPercent: z.number().min(0).max(100),
      })
    )
    .min(1),
});
