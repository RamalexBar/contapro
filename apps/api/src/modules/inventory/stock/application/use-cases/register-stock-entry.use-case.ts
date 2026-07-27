import type { StockEntryInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IStockRepository } from "../../domain/stock.repository";

export class RegisterStockEntryUseCase {
  constructor(private readonly repo: IStockRepository, private readonly audit: AuditService) {}

  async execute(input: StockEntryInput) {
    const userId = getTenantContext().userId;
    const movement = await this.repo.registerEntry(input.productId, input.branchId, input.quantity, input.unitCost, userId);
    await this.audit.record({
      action: "STOCK_ENTRY_REGISTERED",
      entityType: "Product",
      entityId: input.productId,
      description: `Entrada de ${input.quantity} unidades`,
      metadata: { branchId: input.branchId, unitCost: input.unitCost },
    });
    return movement;
  }
}
