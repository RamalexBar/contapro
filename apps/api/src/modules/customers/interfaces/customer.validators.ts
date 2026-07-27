import { z } from "zod";

export const createCustomerSchema = z.object({
  documentType: z.string().min(2),
  documentNumber: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
});
