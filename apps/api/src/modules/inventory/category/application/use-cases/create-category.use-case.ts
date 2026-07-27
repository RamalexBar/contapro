import type { CategoryRecord, ICategoryRepository } from "../../domain/category.repository";

export class CreateCategoryUseCase {
  constructor(private readonly repo: ICategoryRepository) {}
  async execute(name: string, parentId?: string): Promise<CategoryRecord> {
    return this.repo.create(name, parentId);
  }
}
