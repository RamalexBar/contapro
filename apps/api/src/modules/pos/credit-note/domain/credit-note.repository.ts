export interface CreateCreditNoteData {
  branchId: string;
  customerId: string;
  saleId?: string;
  reason: string;
  amount: number;
}

export interface CreditNoteRecord {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: Date;
}

export interface ICreditNoteRepository {
  create(data: CreateCreditNoteData): Promise<CreditNoteRecord>;
  list(): Promise<CreditNoteRecord[]>;
}
