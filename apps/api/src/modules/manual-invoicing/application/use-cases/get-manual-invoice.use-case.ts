import type { IManualInvoiceRepository, ManualInvoiceRecord } from "../../domain/manual-invoice.repository";

export class GetManualInvoiceUseCase {
  constructor(private readonly repo: IManualInvoiceRepository) {}

  async execute(id: string): Promise<ManualInvoiceRecord> {
    return this.repo.findByIdOrThrow(id);
  }
}
