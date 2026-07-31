import { ConflictError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { VoidJournalEntryUseCase } from "../../../accounting/application/use-cases/void-journal-entry.use-case";
import type { IAccountPayableRepository } from "../../domain/account-payable.repository";
import type { IPurchaseRepository, PurchaseRecord } from "../../domain/purchase.repository";

/**
 * Alcance recortado (ver plan/README): solo se puede cancelar una compra si su AccountPayable
 * todavia no tiene abonos (balance === amount) -- reversar abonos parciales es un problema mas
 * grande, no implementado aqui.
 */
export class CancelPurchaseUseCase {
  constructor(
    private readonly purchaseRepo: IPurchaseRepository,
    private readonly accountPayableRepo: IAccountPayableRepository,
    private readonly voidJournalEntry: VoidJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(id: string): Promise<PurchaseRecord> {
    const purchase = await this.purchaseRepo.findByIdOrThrow(id);
    if (purchase.status === "CANCELLED") {
      throw new ValidationError("Esta compra ya esta cancelada");
    }

    const accountPayable = await this.accountPayableRepo.findByIdOrThrow(purchase.accountPayableId);
    if (accountPayable.balance !== accountPayable.amount) {
      throw new ConflictError("Esta compra ya tiene abonos registrados, no se puede cancelar directamente");
    }

    const updated = await this.purchaseRepo.cancel(id);

    if (purchase.journalEntryId) {
      await this.voidJournalEntry.execute(purchase.journalEntryId);
    }

    await this.audit.record({
      action: "PURCHASE_CANCELLED",
      entityType: "Purchase",
      entityId: id,
      description: `Compra cancelada: factura ${purchase.invoiceNumber}`,
    });

    return updated;
  }
}
