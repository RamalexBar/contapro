import type { BrandRecord, IBrandRepository } from "../../domain/brand.repository";

export class CreateBrandUseCase {
  constructor(private readonly repo: IBrandRepository) {}
  async execute(name: string): Promise<BrandRecord> {
    return this.repo.create(name);
  }
}
