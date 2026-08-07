import { z } from "zod";

export const createPriceListSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;

export const updatePriceListSchema = z.object({
  name: z.string().min(1).optional(),
});
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;

export const setProductPriceSchema = z.object({
  price: z.number().positive(),
});
export type SetProductPriceInput = z.infer<typeof setProductPriceSchema>;
