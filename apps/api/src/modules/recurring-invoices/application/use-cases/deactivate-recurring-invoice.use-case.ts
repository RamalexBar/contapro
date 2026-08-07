import type { AuditService } from "../../../audit/application/audit.service";
import type { IRecurringInvoiceRepository, RecurringInvoiceRecord } from "../../domain/recurring-invoice.repository";

export class DeactivateRecurringInvoiceUseCase {
  constructor(private readonly repo: IRecurringInvoiceRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<RecurringInvoiceRecord> {
    const recurringInvoice = await this.repo.deactivate(id);

    await this.audit.record({
      action: "RECURRING_INVOICE_DEACTIVATED",
      entityType: "RecurringInvoice",
      entityId: recurringInvoice.id,
      description: `Plantilla de facturacion recurrente desactivada: ${recurringInvoice.name}`,
    });

    return recurringInvoice;
  }
}
