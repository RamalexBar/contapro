import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
