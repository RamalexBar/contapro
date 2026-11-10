import type { StockEntryInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { PostInventoryJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-inventory-journal-entry.use-case";
import type { IStockRepository } from "../../domain/stock.repository";

/** Entrada manual de mercancia (sin compra registrada). Se contabiliza como aporte: Debito 1435 / Credito 3115. Si la
 * mercancia viene de un proveedor, lo correcto es registrarla por Compras (con su cuenta por pagar). */
export class RegisterStockEntryUseCase {
  constructor(
    private readonly repo: IStockRepository,
    private readonly audit: AuditService,
    private readonly postInventoryEntry?: PostInventoryJournalEntryUseCase
  ) {}

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
    await this.postInventoryEntry?.execute({
      kind: "ENTRY",
      amount: input.quantity * input.unitCost,
      date: movement.createdAt,
      branchId: input.branchId,
      sourceType: "StockMovement",
      sourceId: movement.id,
      description: `Entrada manual de inventario: ${input.quantity} unidades`,
    });
    return movement;
  }
}
