import type { IInvoiceNumberingResolutionRepository, NumberingResolutionRecord } from "../../domain/invoice-numbering-resolution.repository";

export class ListNumberingResolutionsUseCase {
  constructor(private readonly repo: IInvoiceNumberingResolutionRepository) {}

  execute(): Promise<NumberingResolutionRecord[]> {
    return this.repo.list();
  }
}
