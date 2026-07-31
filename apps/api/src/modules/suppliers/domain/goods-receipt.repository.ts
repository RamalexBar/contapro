export interface CreateGoodsReceiptItemData {
  productId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expirationDate?: Date;
}

export interface CreateGoodsReceiptData {
  branchId: string;
  supplierId: string;
  purchaseOrderId?: string;
  items: CreateGoodsReceiptItemData[];
}

export interface GoodsReceiptItemRecord {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  batchNumber: string | null;
  expirationDate: Date | null;
}

export interface GoodsReceiptRecord {
  id: string;
  branchId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  receivedByUserId: string;
  createdAt: Date;
  items: GoodsReceiptItemRecord[];
}

export interface IGoodsReceiptRepository {
  create(data: CreateGoodsReceiptData, receivedByUserId: string): Promise<GoodsReceiptRecord>;
  findByIdOrThrow(id: string): Promise<GoodsReceiptRecord>;
  list(): Promise<GoodsReceiptRecord[]>;
}
