import type { CategoryRecord, ICategoryRepository } from "../../domain/category.repository";

export class ListCategoriesUseCase {
  constructor(private readonly repo: ICategoryRepository) {}
  async execute(): Promise<CategoryRecord[]> {
    return this.repo.list();
  }
}
