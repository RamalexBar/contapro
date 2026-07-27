import { z } from "zod";

export { createSaleSchema, authorizeDiscountSchema } from "@erp/shared-types";

export const cancelSaleSchema = z.object({
  reason: z.string().min(3),
});
