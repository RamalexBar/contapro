export interface QuoteItemInput {
  productId: string;
  quantity: number;
  discountPercent: number;
}

export interface CreateQuoteData {
  branchId: string;
  customerId?: string;
  sellerUserId: string;
  validUntil: Date;
  items: QuoteItemInput[];
}

export interface QuoteRecord {
  id: string;
  status: string;
  subtotal: number;
  total: number;
  validUntil: Date;
  createdAt: Date;
}

export interface IQuoteRepository {
  create(data: CreateQuoteData): Promise<QuoteRecord>;
  list(): Promise<QuoteRecord[]>;
}
