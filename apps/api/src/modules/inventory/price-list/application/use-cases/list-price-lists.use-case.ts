import type { IPriceListRepository, PriceListRecord } from "../../domain/price-list.repository";

export class ListPriceListsUseCase {
  constructor(private readonly repo: IPriceListRepository) {}

  execute(): Promise<PriceListRecord[]> {
    return this.repo.list();
  }
}
