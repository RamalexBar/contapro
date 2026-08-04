import { z } from "zod";

export const createOwnCheckoutSchema = z.object({
  customerEmail: z.string().email(),
  redirectUrl: z.string().url().optional(),
  planId: z.string().uuid().optional(),
});
