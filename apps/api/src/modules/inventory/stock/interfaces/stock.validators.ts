import { z } from "zod";

export { stockEntrySchema, stockAdjustSchema } from "@erp/shared-types";

export const transferStockSchema = z.object({
  productId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  quantity: z.number().positive(),
});
