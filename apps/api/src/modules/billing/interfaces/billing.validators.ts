import { z } from "zod";

export const createOwnCheckoutSchema = z.object({
  customerEmail: z.string().email(),
  redirectUrl: z.string().url().optional(),
  planId: z.string().uuid().optional(),
});

export const saveOwnPaymentSourceSchema = z.object({
  cardToken: z.string().min(1),
  customerEmail: z.string().email(),
  acceptanceToken: z.string().min(1),
});
