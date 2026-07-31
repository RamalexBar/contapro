import type { IPurchaseOrderRepository, PurchaseOrderRecord } from "../../domain/purchase-order.repository";

export class ListPurchaseOrdersUseCase {
  constructor(private readonly repo: IPurchaseOrderRepository) {}

  execute(): Promise<PurchaseOrderRecord[]> {
    return this.repo.list();
  }
}
