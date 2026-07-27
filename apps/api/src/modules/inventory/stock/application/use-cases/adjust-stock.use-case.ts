import type { StockAdjustInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IStockRepository } from "../../domain/stock.repository";

export class AdjustStockUseCase {
  constructor(private readonly repo: IStockRepository, private readonly audit: AuditService) {}

  async execute(input: StockAdjustInput) {
    const userId = getTenantContext().userId;
    const movement = await this.repo.adjust(input.productId, input.branchId, input.quantityDelta, input.reason, userId);
    await this.audit.record({
      action: "STOCK_ADJUSTED",
      entityType: "Product",
      entityId: input.productId,
      description: `Ajuste de inventario (${input.quantityDelta >= 0 ? "+" : ""}${input.quantityDelta}): ${input.reason}`,
      metadata: { branchId: input.branchId, reason: input.reason },
    });
    return movement;
  }
}
