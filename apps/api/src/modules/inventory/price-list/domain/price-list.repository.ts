export interface PriceListRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreatePriceListData {
  code: string;
  name: string;
}

export interface UpdatePriceListData {
  name?: string;
}

export interface ProductPriceRecord {
  productId: string;
  price: number;
}

export interface IPriceListRepository {
  create(data: CreatePriceListData): Promise<PriceListRecord>;
  list(): Promise<PriceListRecord[]>;
  findByIdOrThrow(id: string): Promise<PriceListRecord>;
  update(id: string, data: UpdatePriceListData): Promise<PriceListRecord>;
  deactivate(id: string): Promise<PriceListRecord>;
  listProductPrices(priceListId: string): Promise<ProductPriceRecord[]>;
  upsertProductPrice(priceListId: string, productId: string, price: number): Promise<ProductPriceRecord>;
  removeProductPrice(priceListId: string, productId: string): Promise<void>;
  /** Null si no hay override para ese producto en esa lista -- el caller debe caer al precio
   * base del producto (Product.currentPrice). Usado por CreateSaleUseCase/CreateQuoteUseCase. */
  findProductPrice(priceListId: string, productId: string): Promise<number | null>;
}
