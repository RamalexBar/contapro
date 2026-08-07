import { z } from "zod";
import { withholdingApplicationSchema } from "@erp/shared-types";

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  nit: z.string().min(3),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  isObligatedToInvoice: z.boolean().optional(),
  // Item 37 de docs/ALCANCE.md (informacion exogena DIAN) -- default "NIT" a nivel de schema si
  // se omite.
  documentType: z.enum(["NIT", "CC", "CE"]).optional(),
  municipalityCode: z.string().optional(),
});

export const createPurchaseSchema = z
  .object({
    branchId: z.string().uuid(),
    supplierId: z.string().uuid(),
    invoiceNumber: z.string().min(1),
    subtotal: z.number().nonnegative(),
    taxTotal: z.number().nonnegative().default(0),
    total: z.number().positive(),
    dueDate: z.coerce.date(),
    withholdings: z.array(withholdingApplicationSchema).default([]),
    // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- ver createSaleSchema en
    // @erp/shared-types, mismo criterio.
    currency: z.string().length(3).toUpperCase().default("COP"),
    exchangeRate: z.number().positive().default(1),
  })
  .refine((v) => v.currency === "COP" || v.exchangeRate !== 1, {
    message: "Debes indicar la tasa de cambio (TRM) cuando la moneda no es COP",
    path: ["exchangeRate"],
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
