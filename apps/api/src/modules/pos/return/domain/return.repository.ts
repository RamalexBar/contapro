export interface CreateReturnItemData {
  saleItemId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  restockedToBranch: boolean;
}

export interface CreateReturnData {
  branchId: string;
  saleId: string;
  customerId?: string;
  reason: string;
  total: number;
  createdByUserId: string;
  items: CreateReturnItemData[];
}

export interface ReturnRecord {
  id: string;
  branchId: string;
  saleId: string;
  customerId: string | null;
  reason: string;
  status: string;
  total: number;
  createdAt: Date;
  items: Array<{
    id: string;
    saleItemId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    restockedToBranch: boolean;
  }>;
}

export interface IReturnRepository {
  /**
   * Crea la devolucion y, dentro de la misma transaccion: valida que la cantidad devuelta
   * (sumada a lo ya devuelto antes) no exceda lo vendido en cada `SaleItem`, restaura inventario
   * (stock, lote nuevo si el producto rastrea lotes, StockMovement RETURN_IN, Kardex) por cada
   * item con `restockedToBranch`, y actualiza `Sale.status` a RETURNED_PARTIAL/RETURNED_FULL
   * segun corresponda. Ver README del modulo para el detalle.
   */
  create(data: CreateReturnData): Promise<ReturnRecord>;
  list(filters: { saleId?: string; take?: number; skip?: number }): Promise<ReturnRecord[]>;
}
