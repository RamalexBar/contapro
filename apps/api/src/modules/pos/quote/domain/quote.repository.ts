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
  // Lista de precios efectiva ya resuelta por CreateQuoteUseCase (item 35 de docs/ALCANCE.md) --
  // mismo criterio que Sale.priceListId.
  priceListId: string | null;
}

export interface QuoteRecord {
  id: string;
  status: string;
  subtotal: number;
  total: number;
  validUntil: Date;
  createdAt: Date;
  priceListId: string | null;
}

export interface QuoteItemDetail {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

export interface QuoteDetail extends QuoteRecord {
  customerName: string | null;
  items: QuoteItemDetail[];
}

export interface IQuoteRepository {
  create(data: CreateQuoteData): Promise<QuoteRecord>;
  list(): Promise<QuoteRecord[]>;
  /** Usado por el boton "Imprimir" (GET /quotes/:id/pdf) -- resuelve nombre de cliente/producto
   * para que el PDF no muestre ids crudos. */
  findByIdOrThrow(id: string): Promise<QuoteDetail>;
}
