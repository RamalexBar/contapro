import { z } from "zod";

const recurringInvoiceItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const createRecurringInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().min(1),
  dayOfMonth: z.number().int().min(1).max(28),
  priceListId: z.string().uuid().optional(),
  dueDays: z.number().int().positive().default(30),
  items: z.array(recurringInvoiceItemSchema).min(1),
});
export type CreateRecurringInvoiceInput = z.infer<typeof createRecurringInvoiceSchema>;

export const updateRecurringInvoiceSchema = z.object({
  name: z.string().min(1).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  priceListId: z.string().uuid().nullable().optional(),
  dueDays: z.number().int().positive().optional(),
  items: z.array(recurringInvoiceItemSchema).min(1).optional(),
});
export type UpdateRecurringInvoiceInput = z.infer<typeof updateRecurringInvoiceSchema>;
