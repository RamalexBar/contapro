export interface CreatePurchaseData {
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  dueDate: Date;
}

export interface PurchaseRecord {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: string;
  createdAt: Date;
  accountPayableId: string;
  dueDate: Date;
}

export interface IPurchaseRepository {
  create(data: CreatePurchaseData): Promise<PurchaseRecord>;
  findByIdOrThrow(id: string): Promise<PurchaseRecord>;
  list(filters: { take?: number; skip?: number }): Promise<PurchaseRecord[]>;
}
