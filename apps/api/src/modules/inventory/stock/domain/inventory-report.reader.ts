/** Lectura plana para los reportes de inventario valorizado y alertas de stock (sin Prisma). */

export interface StockLayerSnapshot {
  quantity: number;
  unitCost: number;
  enteredAt: Date;
  batchNumber: string;
}

export interface StockLevelSnapshot {
  productId: string;
  sku: string;
  name: string;
  categoryName: string | null;
  unit: string;
  branchId: string;
  branchName: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  /** Product.currentCost: valoriza lo que no tenga capa (desfase heredado). */
  currentCost: number;
  /** Capas PEPS con saldo, de la mas vieja a la mas nueva (vacio si no se pidieron). */
  layers: StockLayerSnapshot[];
}

export interface IInventoryReportReader {
  /** Existencias de productos activos por sucursal (todas las sucursales si no se pasa branchId). */
  listStockLevels(filter: { branchId?: string; withLayers: boolean }): Promise<StockLevelSnapshot[]>;
}
