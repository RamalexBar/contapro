import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPurchaseOrderRepository, PurchaseOrderRecord } from "../../domain/purchase-order.repository";

export class SendPurchaseOrderUseCase {
  constructor(private readonly repo: IPurchaseOrderRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<PurchaseOrderRecord> {
    const order = await this.repo.findByIdOrThrow(id);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Solo se puede enviar una orden en estado DRAFT (actual: ${order.status})`);
    }

    const updated = await this.repo.updateStatus(id, "SENT");

    await this.audit.record({
      action: "PURCHASE_ORDER_SENT",
      entityType: "PurchaseOrder",
      entityId: id,
      description: `Orden de compra enviada al proveedor`,
    });

    return updated;
  }
}
