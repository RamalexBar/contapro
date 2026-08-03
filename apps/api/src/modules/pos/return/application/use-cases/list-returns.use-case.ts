import type { IReturnRepository, ReturnRecord } from "../../domain/return.repository";

export class ListReturnsUseCase {
  constructor(private readonly repo: IReturnRepository) {}

  async execute(filters: { saleId?: string; take?: number; skip?: number }): Promise<ReturnRecord[]> {
    return this.repo.list(filters);
  }
}
