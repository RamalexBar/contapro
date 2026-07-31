import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { CreatePurchaseOrderData, IPurchaseOrderRepository, PurchaseOrderRecord } from "../../domain/purchase-order.repository";

export class CreatePurchaseOrderUseCase {
  constructor(private readonly repo: IPurchaseOrderRepository, private readonly audit: AuditService) {}

  async execute(data: CreatePurchaseOrderData): Promise<PurchaseOrderRecord> {
    const userId = getTenantContext().userId;
    const order = await this.repo.create(data, userId);

    await this.audit.record({
      action: "PURCHASE_ORDER_CREATED",
      entityType: "PurchaseOrder",
      entityId: order.id,
      description: `Orden de compra creada por ${order.total}`,
    });

    return order;
  }
}
