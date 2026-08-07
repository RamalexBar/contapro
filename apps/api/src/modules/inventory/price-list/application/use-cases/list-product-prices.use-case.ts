import type { IPriceListRepository, ProductPriceRecord } from "../../domain/price-list.repository";

export class ListProductPricesUseCase {
  constructor(private readonly repo: IPriceListRepository) {}

  execute(priceListId: string): Promise<ProductPriceRecord[]> {
    return this.repo.listProductPrices(priceListId);
  }
}
