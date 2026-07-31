export interface CreatePurchaseOrderItemData {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderData {
  branchId: string;
  supplierId: string;
  expectedDate?: Date;
  items: CreatePurchaseOrderItemData[];
}

export interface PurchaseOrderRecord {
  id: string;
  branchId: string;
  supplierId: string;
  status: string;
  expectedDate: Date | null;
  total: number;
  createdAt: Date;
}

export interface PurchaseOrderItemRecord {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  total: number;
  /** Suma de GoodsReceiptItem.quantity de todas las recepciones hechas contra esta orden para
   * este producto -- derivado, no se duplica en una columna propia. */
  receivedQuantity: number;
}

export interface PurchaseOrderWithItems extends PurchaseOrderRecord {
  items: PurchaseOrderItemRecord[];
}

export interface IPurchaseOrderRepository {
  /** El total se calcula del lado del servidor sumando quantity*unitCost de cada item -- a
   * diferencia de Purchase (que refleja una factura externa del proveedor con su propio total a
   * reconciliar), una orden de compra es un documento que emite la propia empresa. */
  create(data: CreatePurchaseOrderData, createdByUserId: string): Promise<PurchaseOrderRecord>;
  updateStatus(id: string, status: string): Promise<PurchaseOrderRecord>;
  findByIdOrThrow(id: string): Promise<PurchaseOrderWithItems>;
  list(): Promise<PurchaseOrderRecord[]>;
}
