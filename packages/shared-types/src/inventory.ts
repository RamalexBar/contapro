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
  /** Ubicacion en la estanteria (ej. "Pasillo 3 - Estante B"). */
  location: z.string().trim().max(60).optional(),
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

/**
 * Importacion masiva desde Excel/CSV. El archivo se lee en el navegador (cada fila llega con las
 * columnas ya mapeadas a estos campos); la API valida todo antes de crear nada. `sku` es opcional
 * porque las exportaciones de Alegra/Siigo no siempre traen referencia -- se genera una.
 */
export const importProductRowSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre"),
  sku: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  price: z.number({ invalid_type_error: "Precio invalido", required_error: "Falta el precio" }).nonnegative("El precio no puede ser negativo"),
  cost: z.number({ invalid_type_error: "Costo invalido" }).nonnegative("El costo no puede ser negativo").optional(),
  taxRate: z.number({ invalid_type_error: "IVA invalido" }).min(0, "IVA fuera de rango (0-100)").max(100, "IVA fuera de rango (0-100)").optional(),
  initialStock: z.number({ invalid_type_error: "Stock invalido" }).nonnegative("El stock no puede ser negativo").optional(),
  minStock: z.number({ invalid_type_error: "Stock minimo invalido" }).nonnegative("El stock minimo no puede ser negativo").optional(),
  location: z.string().trim().min(1).max(60, "Ubicacion muy larga (maximo 60 caracteres)").optional(),
});
export type ImportProductRow = z.infer<typeof importProductRowSchema>;

export const importProductsSchema = z.object({
  // Filas crudas: cada una se valida por separado contra importProductRowSchema para reportar el
  // error con su numero de fila, en vez de rechazar el lote entero con un 400 opaco.
  rows: z.array(z.unknown()).min(1, "El archivo no tiene filas").max(5000, "Maximo 5.000 productos por archivo"),
  /**
   * Numero de fila real en Excel de cada elemento de `rows` (mismo orden). El archivo puede traer
   * filas de titulo antes del encabezado o filas vacias en medio (exportaciones de Alegra/Siigo);
   * sin esto se asume encabezado en la fila 1 y filas seguidas.
   */
  rowNumbers: z.array(z.number().int().positive()).optional(),
  pricesIncludeTax: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});
export type ImportProductsInput = z.infer<typeof importProductsSchema>;

export interface ImportProductsRowError {
  /** Numero de fila tal como lo ve el usuario en Excel (la fila 1 es el encabezado). */
  rowNumber: number;
  messages: string[];
}

export interface ImportProductsResult {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  created: number;
  categoriesCreated: string[];
  errors: ImportProductsRowError[];
}

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().trim().max(60).nullable().optional(),
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
