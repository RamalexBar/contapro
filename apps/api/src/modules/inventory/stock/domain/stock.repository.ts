export interface StockMovementRecord {
  id: string;
  productId: string;
  branchId: string;
  type: string;
  quantity: number;
  unitCost: number;
  createdAt: Date;
}

export interface IStockRepository {
  registerEntry(productId: string, branchId: string, quantity: number, unitCost: number, userId: string): Promise<StockMovementRecord>;
  adjust(productId: string, branchId: string, quantityDelta: number, reason: string, userId: string): Promise<StockMovementRecord>;
  transfer(productId: string, fromBranchId: string, toBranchId: string, quantity: number, userId: string): Promise<void>;
  getBranchStock(productId: string, branchId: string): Promise<{ quantity: number; minStock: number; maxStock: number } | null>;
}
