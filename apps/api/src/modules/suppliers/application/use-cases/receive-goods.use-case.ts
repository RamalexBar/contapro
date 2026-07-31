import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IStockRepository } from "../../../inventory/stock/domain/stock.repository";
import type { CreateGoodsReceiptData, GoodsReceiptRecord, IGoodsReceiptRepository } from "../../domain/goods-receipt.repository";
import type { IPurchaseOrderRepository } from "../../domain/purchase-order.repository";

/**
 * PurchaseOrder/GoodsReceipt y Purchase (factura) no se enlazan entre si en el schema (sin
 * FK cruzada) -- son flujos paralelos que comparten solo supplierId, ver README del modulo. Este
 * caso de uso solo impacta inventario; contabilizar/facturar sigue siendo CreatePurchaseUseCase,
 * sin cambios.
 *
 * NOTA: crear el GoodsReceipt y aplicar el impacto en inventario son dos llamadas separadas (dos
 * transacciones Prisma distintas, no una sola) -- mismo criterio ya usado por CreatePurchaseUseCase
 * al llamar a PostPurchaseJournalEntryUseCase: no hay una transaccion distribuida entre modulos en
 * este codebase. Si el segundo paso falla, el GoodsReceipt ya quedo creado sin impacto en stock
 * (inconsistencia posible, documentada como limitacion conocida en el README).
 */
export class ReceiveGoodsUseCase {
  constructor(
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly stockRepo: IStockRepository,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreateGoodsReceiptData): Promise<GoodsReceiptRecord> {
    const userId = getTenantContext().userId;
    const receipt = await this.goodsReceiptRepo.create(data, userId);

    await this.stockRepo.receiveGoods(
      receipt.items.map((item) => ({
        productId: item.productId,
        branchId: receipt.branchId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        batchNumber: item.batchNumber ?? undefined,
        expirationDate: item.expirationDate ?? undefined,
      })),
      "GoodsReceipt",
      receipt.id,
      userId
    );

    await this.audit.record({
      action: "GOODS_RECEIPT_REGISTERED",
      entityType: "GoodsReceipt",
      entityId: receipt.id,
      description: `Recepcion de mercancia registrada: ${receipt.items.length} item(s)`,
    });

    if (receipt.purchaseOrderId) {
      const order = await this.purchaseOrderRepo.findByIdOrThrow(receipt.purchaseOrderId);
      const allComplete = order.items.every((item) => item.receivedQuantity >= item.quantity);
      const anyReceived = order.items.some((item) => item.receivedQuantity > 0);
      const newStatus = allComplete ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : order.status;
      if (newStatus !== order.status) {
        await this.purchaseOrderRepo.updateStatus(order.id, newStatus);
      }
    }

    return receipt;
  }
}
