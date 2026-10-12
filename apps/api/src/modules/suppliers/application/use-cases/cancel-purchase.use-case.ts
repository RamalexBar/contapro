import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { VoidJournalEntryUseCase } from "../../../accounting/application/use-cases/void-journal-entry.use-case";
import type { IJournalEntryRepository } from "../../../accounting/domain/journal-entry.repository";
import type { IAccountPayableRepository } from "../../domain/account-payable.repository";
import type { IPurchaseRepository, PurchaseRecord } from "../../domain/purchase.repository";
import type { IGoodsReceiptRepository } from "../../domain/goods-receipt.repository";
import type { IStockRepository } from "../../../inventory/stock/domain/stock.repository";
import { getTenantContext } from "../../../../shared/context/request-context";

/**
 * Cancelar una compra que ya tiene abonos registrados reversa esos abonos primero (restaura
 * balance=amount en el AccountPayable y anula el comprobante contable de cada uno), en vez de
 * bloquear con 409 como antes (ver README/ALCANCE: "reversar abonos" era el pendiente). No
 * reversa dinero real de caja/banco -- solo anula los comprobantes, igual que ya se hacia con el
 * comprobante de la compra misma.
 *
 * Si la compra metio mercancia al inventario (GoodsReceipt con purchaseId, ver
 * CreatePurchaseUseCase), lo primero es devolverla: si parte ya se vendio, la cancelacion se
 * rechaza antes de tocar abonos, comprobantes o la compra.
 */
export class CancelPurchaseUseCase {
  constructor(
    private readonly purchaseRepo: IPurchaseRepository,
    private readonly accountPayableRepo: IAccountPayableRepository,
    private readonly journalRepo: IJournalEntryRepository,
    private readonly voidJournalEntry: VoidJournalEntryUseCase,
    private readonly audit: AuditService,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly stockRepo: IStockRepository
  ) {}

  async execute(id: string): Promise<PurchaseRecord> {
    const purchase = await this.purchaseRepo.findByIdOrThrow(id);
    if (purchase.status === "CANCELLED") {
      throw new ValidationError("Esta compra ya esta cancelada");
    }

    const receipt = await this.goodsReceiptRepo.findByPurchaseId(id);
    if (receipt) {
      await this.stockRepo.returnGoods(
        receipt.items.map((item) => ({
          productId: item.productId,
          branchId: receipt.branchId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
        "PurchaseCancellation",
        purchase.id,
        getTenantContext().userId
      );
    }

    const accountPayable = await this.accountPayableRepo.findByIdOrThrow(purchase.accountPayableId);
    if (accountPayable.balance !== accountPayable.amount) {
      const { reversedPayments } = await this.accountPayableRepo.reverseAllPayments(purchase.accountPayableId);

      for (const payment of reversedPayments) {
        const paymentEntry = await this.journalRepo.findBySource("SupplierPayment", payment.id);
        if (paymentEntry && paymentEntry.status !== "VOID") {
          await this.voidJournalEntry.execute(paymentEntry.id);
        }

        await this.audit.record({
          action: "SUPPLIER_PAYMENT_REVERSED",
          entityType: "SupplierPayment",
          entityId: payment.id,
          description: `Abono de ${payment.amount} reversado al cancelar la compra ${purchase.invoiceNumber}`,
        });
      }
    }

    const updated = await this.purchaseRepo.cancel(id);

    if (purchase.journalEntryId) {
      await this.voidJournalEntry.execute(purchase.journalEntryId);
    }

    await this.audit.record({
      action: "PURCHASE_CANCELLED",
      entityType: "Purchase",
      entityId: id,
      description: receipt
        ? `Compra cancelada: factura ${purchase.invoiceNumber} (se devolvieron ${receipt.items.length} producto(s) del inventario)`
        : `Compra cancelada: factura ${purchase.invoiceNumber}`,
    });

    return updated;
  }
}
