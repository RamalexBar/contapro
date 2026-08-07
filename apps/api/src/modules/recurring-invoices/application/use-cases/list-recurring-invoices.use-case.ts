import type { IRecurringInvoiceRepository, RecurringInvoiceRecord } from "../../domain/recurring-invoice.repository";

export class ListRecurringInvoicesUseCase {
  constructor(private readonly repo: IRecurringInvoiceRepository) {}

  execute(): Promise<RecurringInvoiceRecord[]> {
    return this.repo.list();
  }
}
