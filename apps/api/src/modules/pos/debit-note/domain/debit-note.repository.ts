export interface CreateDebitNoteData {
  branchId: string;
  customerId: string;
  saleId?: string;
  reason: string;
  amount: number;
}

export interface DebitNoteRecord {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: Date;
}

export interface IDebitNoteRepository {
  create(data: CreateDebitNoteData): Promise<DebitNoteRecord>;
  list(): Promise<DebitNoteRecord[]>;
}
