export interface StockMovementRecord {
  id: string;
  productId: string;
  branchId: string;
  type: string;
  quantity: number;
  unitCost: number;
  createdAt: Date;
}

export interface ReceiveGoodsItem {
  productId: string;
  branchId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expirationDate?: Date;
}

export interface IStockRepository {
  registerEntry(productId: string, branchId: string, quantity: number, unitCost: number, userId: string): Promise<StockMovementRecord>;
  adjust(productId: string, branchId: string, quantityDelta: number, reason: string, userId: string): Promise<StockMovementRecord>;
  transfer(productId: string, fromBranchId: string, toBranchId: string, quantity: number, userId: string): Promise<void>;
  getBranchStock(productId: string, branchId: string): Promise<{ quantity: number; minStock: number; maxStock: number } | null>;
  /** Item 42 de docs/ALCANCE.md: stock de TODOS los productos de una sucursal en una sola
   * consulta (a diferencia de getBranchStock, que es de a uno) -- usado por la pantalla
   * Inventario del movil. Solo devuelve filas con stock registrado (un producto sin ninguna
   * entrada en ProductBranchStock para esa sucursal simplemente no aparece). */
  listBranchStock(branchId: string): Promise<Array<{ productId: string; quantity: number; minStock: number; maxStock: number }>>;
  /** Entrada de stock por recepcion de mercancia (compras): por cada item suma la cantidad en la
   * sucursal, crea un StockMovement PURCHASE_IN referenciando el origen (referenceType/Id), crea
   * un Batch si el producto tracksBatches, y recalcula Product.currentCost segun costMethod (ver
   * README de suppliers para el detalle del calculo). */
  receiveGoods(items: ReceiveGoodsItem[], referenceType: string, referenceId: string, userId: string): Promise<StockMovementRecord[]>;
}
