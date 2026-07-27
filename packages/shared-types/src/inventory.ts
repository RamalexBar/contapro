import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createBrandSchema = z.object({
  name: z.string().min(1),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  unit: z.string().default("UN"),
  currentCost: z.number().nonnegative(),
  currentPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100).default(19),
  barcode: z.string().optional(),
  initialStock: z.number().nonnegative().default(0),
  minStock: z.number().nonnegative().default(0),
  maxStock: z.number().nonnegative().default(0),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  unit: z.string().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Requiere permiso `product.price.update` / `product.cost.update` (NO lo tiene el Cajero). */
export const updateProductPriceSchema = z.object({
  newPrice: z.number().positive().optional(),
  newCost: z.number().nonnegative().optional(),
});
export type UpdateProductPriceInput = z.infer<typeof updateProductPriceSchema>;

/** Requiere permiso `product.barcode.update` (NO lo tiene el Cajero). */
export const updateProductBarcodeSchema = z.object({
  code: z.string().min(4),
  type: z.string().default("EAN13"),
});
export type UpdateProductBarcodeInput = z.infer<typeof updateProductBarcodeSchema>;

export const stockEntrySchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
});
export type StockEntryInput = z.infer<typeof stockEntrySchema>;

export const stockAdjustSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantityDelta: z.number(), // positivo = ADJUSTMENT_IN, negativo = ADJUSTMENT_OUT
  reason: z.string().min(1),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
