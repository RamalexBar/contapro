import type { IPurchaseRepository, PurchaseRecord } from "../../domain/purchase.repository";

export class ListPurchasesUseCase {
  constructor(private readonly repo: IPurchaseRepository) {}

  execute(filters: { take?: number; skip?: number } = {}): Promise<PurchaseRecord[]> {
    return this.repo.list(filters);
  }
}
