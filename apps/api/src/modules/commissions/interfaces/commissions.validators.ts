import { z } from "zod";

export const createSalesCommissionSchemeSchema = z.object({
  sellerUserId: z.string().uuid(),
  ratePercent: z.number().min(0).max(100),
});
export type CreateSalesCommissionSchemeInput = z.infer<typeof createSalesCommissionSchemeSchema>;

export const updateSalesCommissionSchemeSchema = z.object({
  ratePercent: z.number().min(0).max(100).optional(),
});
export type UpdateSalesCommissionSchemeInput = z.infer<typeof updateSalesCommissionSchemeSchema>;

export const calculateCommissionsSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});
export type CalculateCommissionsInput = z.infer<typeof calculateCommissionsSchema>;

export const payCommissionSettlementSchema = z.object({
  branchId: z.string().uuid(),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
});
export type PayCommissionSettlementInput = z.infer<typeof payCommissionSettlementSchema>;
