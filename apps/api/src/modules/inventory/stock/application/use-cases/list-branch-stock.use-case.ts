import type { IStockRepository } from "../../domain/stock.repository";

export class ListBranchStockUseCase {
  constructor(private readonly repo: IStockRepository) {}

  execute(branchId: string) {
    return this.repo.listBranchStock(branchId);
  }
}
