import type { ISalesCommissionSchemeRepository, SalesCommissionSchemeRecord } from "../../domain/sales-commission-scheme.repository";

export class ListSalesCommissionSchemesUseCase {
  constructor(private readonly repo: ISalesCommissionSchemeRepository) {}

  execute(): Promise<SalesCommissionSchemeRecord[]> {
    return this.repo.list();
  }
}
