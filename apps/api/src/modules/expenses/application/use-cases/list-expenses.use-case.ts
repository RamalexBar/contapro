import type { ExpenseRecord, IExpenseRepository } from "../../domain/expense.repository";

export class ListExpensesUseCase {
  constructor(private readonly repo: IExpenseRepository) {}

  execute(filters: { take?: number; skip?: number } = {}): Promise<ExpenseRecord[]> {
    return this.repo.list(filters);
  }
}
