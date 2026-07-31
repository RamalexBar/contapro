import type { IPurchaseOrderRepository, PurchaseOrderWithItems } from "../../domain/purchase-order.repository";

export class GetPurchaseOrderUseCase {
  constructor(private readonly repo: IPurchaseOrderRepository) {}

  execute(id: string): Promise<PurchaseOrderWithItems> {
    return this.repo.findByIdOrThrow(id);
  }
}
