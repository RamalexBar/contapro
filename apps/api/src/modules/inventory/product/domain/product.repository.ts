import type { Product } from "./product.entity";

export interface CreateProductData {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  unit?: string;
  currentCost: number;
  currentPrice: number;
  taxRate?: number;
  barcode?: string;
  branchId: string;
  initialStock: number;
  minStock: number;
  maxStock: number;
}

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  currentPrice: number;
  currentCost: number;
  taxRate: number;
  isActive: boolean;
  barcodes: string[];
}

export interface IProductRepository {
  create(data: CreateProductData): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  findByIdOrThrow(id: string): Promise<Product>;
  findByBarcode(code: string): Promise<Product | null>;
  list(search?: string): Promise<ProductListItem[]>;
  updateBasicInfo(id: string, data: { name?: string; description?: string; categoryId?: string | null; brandId?: string | null; unit?: string }): Promise<Product>;
  savePriceAndCost(product: Product): Promise<Product>;
  updateBarcode(id: string, code: string, type?: string): Promise<void>;
  softDelete(id: string): Promise<void>;
}
