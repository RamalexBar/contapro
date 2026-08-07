import { z } from "zod";

export const OPPORTUNITY_STAGES = ["PROSPECTO", "CONTACTO", "PROPUESTA", "NEGOCIACION", "GANADA", "PERDIDA"] as const;

export const opportunityItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const createOpportunitySchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid(),
  // Si se omite, ownerUserId = usuario autenticado (ver create-opportunity.use-case.ts).
  ownerUserId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  expectedCloseDate: z.coerce.date().optional(),
  items: z.array(opportunityItemInputSchema).min(1),
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const updateStageSchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES),
  lostReason: z.string().min(1).optional(),
});
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

export const closeAsWonSchema = z.object({
  paymentMethod: z.enum(["CASH", "CREDIT"]).default("CREDIT"),
});
export type CloseAsWonInput = z.infer<typeof closeAsWonSchema>;
