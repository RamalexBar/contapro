import type { StockAdjustInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { PostInventoryJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-inventory-journal-entry.use-case";
import type { IStockRepository } from "../../domain/stock.repository";

/** Ajuste de inventario con su asiento al costo real PEPS: sobrante Debito 1435 / Credito 4295; faltante Debito 5195 /
 * Credito 1435. */
export class AdjustStockUseCase {
  constructor(
    private readonly repo: IStockRepository,
    private readonly audit: AuditService,
    private readonly postInventoryEntry?: PostInventoryJournalEntryUseCase
  ) {}

  async execute(input: StockAdjustInput) {
    const userId = getTenantContext().userId;
    const { totalCost, ...movement } = await this.repo.adjust(input.productId, input.branchId, input.quantityDelta, input.reason, userId);
    await this.audit.record({
      action: "STOCK_ADJUSTED",
      entityType: "Product",
      entityId: input.productId,
      description: `Ajuste de inventario (${input.quantityDelta >= 0 ? "+" : ""}${input.quantityDelta}): ${input.reason}`,
      metadata: { branchId: input.branchId, reason: input.reason },
    });
    await this.postInventoryEntry?.execute({
      kind: input.quantityDelta >= 0 ? "SURPLUS" : "SHORTAGE",
      amount: totalCost,
      date: movement.createdAt,
      branchId: input.branchId,
      sourceType: "StockMovement",
      sourceId: movement.id,
      description: `Ajuste de inventario (${input.quantityDelta >= 0 ? "+" : ""}${input.quantityDelta}): ${input.reason}`,
    });
    return movement;
  }
}
