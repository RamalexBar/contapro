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

const purchaseOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
});

export const createPurchaseOrderSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  expectedDate: z.coerce.date().optional(),
  items: z.array(purchaseOrderItemSchema).min(1),
});

const goodsReceiptItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  batchNumber: z.string().optional(),
  expirationDate: z.coerce.date().optional(),
});

export const receiveGoodsSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  items: z.array(goodsReceiptItemSchema).min(1),
});

export const registerSupplierPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "TRANSFER", "MIXED"]),
});
