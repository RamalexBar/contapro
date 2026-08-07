import type { ExpenseCategoryRecord, IExpenseCategoryRepository } from "../../domain/expense-category.repository";

export class ListExpenseCategoriesUseCase {
  constructor(private readonly repo: IExpenseCategoryRepository) {}

  execute(): Promise<ExpenseCategoryRecord[]> {
    return this.repo.list();
  }
}
