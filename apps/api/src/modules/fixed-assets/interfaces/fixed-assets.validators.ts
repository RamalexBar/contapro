import { z } from "zod";

export const createFixedAssetSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  purchaseDate: z.coerce.date(),
  cost: z.number().positive(),
  salvageValue: z.number().nonnegative().optional(),
  usefulLifeMonths: z.number().int().positive(),
});
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>;

export const updateFixedAssetSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export type UpdateFixedAssetInput = z.infer<typeof updateFixedAssetSchema>;

export const calculateDepreciationSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});
export type CalculateDepreciationInput = z.infer<typeof calculateDepreciationSchema>;
