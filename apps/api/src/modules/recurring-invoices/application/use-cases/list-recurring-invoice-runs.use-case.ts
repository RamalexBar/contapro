import type { IRecurringInvoiceRepository, RecurringInvoiceRunRecord } from "../../domain/recurring-invoice.repository";

export class ListRecurringInvoiceRunsUseCase {
  constructor(private readonly repo: IRecurringInvoiceRepository) {}

  async execute(recurringInvoiceId: string): Promise<RecurringInvoiceRunRecord[]> {
    // findByIdOrThrow confirma que la plantilla pertenece al tenant actual antes de listar su
    // historial (mismo criterio que listProductPrices en price-list.container.ts).
    await this.repo.findByIdOrThrow(recurringInvoiceId);
    return this.repo.listRuns(recurringInvoiceId);
  }
}
