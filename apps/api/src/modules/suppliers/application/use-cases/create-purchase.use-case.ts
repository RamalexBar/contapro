import { round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostPurchaseJournalEntryUseCase } from "../../../accounting/application/use-cases/post-purchase-journal-entry.use-case";
import type { ISupplierRepository } from "../../domain/supplier.repository";
import type { CreatePurchaseData, IPurchaseRepository, PurchaseRecord } from "../../domain/purchase.repository";

/**
 * Registro minimo de una factura de compra (sin flujo de orden de compra/recepcion de
 * mercancia todavia, ver README.md): crea el Purchase + su AccountPayable y contabiliza de
 * una vez el comprobante (Inventario + IVA descontable vs Proveedores).
 */
export class CreatePurchaseUseCase {
  constructor(
    private readonly purchaseRepo: IPurchaseRepository,
    private readonly supplierRepo: ISupplierRepository,
    private readonly postPurchaseJournalEntry: PostPurchaseJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreatePurchaseData): Promise<PurchaseRecord> {
    await this.supplierRepo.findByIdOrThrow(data.supplierId);

    const expectedTotal = round2(data.subtotal + data.taxTotal);
    if (expectedTotal !== round2(data.total)) {
      throw new ValidationError(`El total (${data.total}) no coincide con subtotal + IVA (${expectedTotal})`);
    }

    const purchase = await this.purchaseRepo.create(data);

    await this.audit.record({
      action: "PURCHASE_REGISTERED",
      entityType: "Purchase",
      entityId: purchase.id,
      description: `Compra registrada: factura ${purchase.invoiceNumber} por ${purchase.total}`,
    });

    await this.postPurchaseJournalEntry.execute({
      purchaseId: purchase.id,
      branchId: purchase.branchId,
      date: purchase.createdAt,
      invoiceNumber: purchase.invoiceNumber,
      subtotal: purchase.subtotal,
      taxTotal: purchase.taxTotal,
      total: purchase.total,
    });

    return purchase;
  }
}
