import { z } from "zod";

export { stockEntrySchema, stockAdjustSchema } from "@erp/shared-types";

export const transferStockSchema = z.object({
  productId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const listKardexQuerySchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
