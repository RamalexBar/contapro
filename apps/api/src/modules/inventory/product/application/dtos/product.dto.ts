export interface ProductResponseDto {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  unit: string;
  currentCost: number;
  currentPrice: number;
  taxRate: number;
  isActive: boolean;
}
