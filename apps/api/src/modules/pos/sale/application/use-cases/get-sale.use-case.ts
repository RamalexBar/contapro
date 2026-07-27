import type { ISaleRepository, SaleRecord } from "../../domain/sale.repository";

export class GetSaleUseCase {
  constructor(private readonly saleRepo: ISaleRepository) {}
  async execute(id: string): Promise<SaleRecord> {
    return this.saleRepo.findByIdOrThrow(id);
  }
}
