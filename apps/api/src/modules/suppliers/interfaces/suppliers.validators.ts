import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  nit: z.string().min(3),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  isObligatedToInvoice: z.boolean().optional(),
});

export const createPurchaseSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().positive(),
  dueDate: z.coerce.date(),
});
