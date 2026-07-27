import type { ISaleRepository, SaleRecord } from "../../domain/sale.repository";

export class ListSalesUseCase {
  constructor(private readonly saleRepo: ISaleRepository) {}
  async execute(take?: number, skip?: number): Promise<SaleRecord[]> {
    return this.saleRepo.list({ take, skip });
  }
}
