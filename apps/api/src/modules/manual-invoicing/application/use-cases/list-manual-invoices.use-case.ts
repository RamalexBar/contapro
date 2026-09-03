import type { IManualInvoiceRepository, ManualInvoiceRecord } from "../../domain/manual-invoice.repository";

export class ListManualInvoicesUseCase {
  constructor(private readonly repo: IManualInvoiceRepository) {}

  async execute(): Promise<ManualInvoiceRecord[]> {
    return this.repo.list();
  }
}
