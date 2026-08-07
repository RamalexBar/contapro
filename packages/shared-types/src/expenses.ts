import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  accountCode: z.string().min(1),
});
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(1).optional(),
  accountCode: z.string().min(1).optional(),
});
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const createExpenseSchema = z.object({
  branchId: z.string().uuid(),
  expenseCategoryId: z.string().uuid(),
  payeeName: z.string().min(1),
  description: z.string().optional(),
  date: z.coerce.date(),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().positive(),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
  // Item 34 de docs/ALCANCE.md (centros de costo) -- opcional.
  costCenterId: z.string().uuid().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
