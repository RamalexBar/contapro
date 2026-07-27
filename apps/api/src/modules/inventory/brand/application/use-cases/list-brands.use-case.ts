import type { BrandRecord, IBrandRepository } from "../../domain/brand.repository";

export class ListBrandsUseCase {
  constructor(private readonly repo: IBrandRepository) {}
  async execute(): Promise<BrandRecord[]> {
    return this.repo.list();
  }
}
