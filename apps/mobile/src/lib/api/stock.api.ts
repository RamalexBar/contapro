import { apiFetch } from "../api-client";

/** Item 42 de docs/ALCANCE.md: GET /stock/branch-stock, nuevo (antes solo existia
 * getBranchStock de un producto a la vez, uso interno). Usado por InventoryScreen. */
export interface BranchStockItem {
  productId: string;
  quantity: number;
  minStock: number;
  maxStock: number;
}

export function getBranchStock(branchId: string): Promise<{ data: BranchStockItem[] }> {
  return apiFetch(`/stock/branch-stock?branchId=${branchId}`);
}
