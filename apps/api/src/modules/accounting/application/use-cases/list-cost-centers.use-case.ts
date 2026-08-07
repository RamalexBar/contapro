import type { CostCenterRecord, ICostCenterRepository } from "../../domain/cost-center.repository";

export class ListCostCentersUseCase {
  constructor(private readonly repo: ICostCenterRepository) {}

  execute(): Promise<CostCenterRecord[]> {
    return this.repo.list();
  }
}
