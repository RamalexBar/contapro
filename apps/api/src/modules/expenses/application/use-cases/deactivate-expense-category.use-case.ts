import type { AuditService } from "../../../audit/application/audit.service";
import type { ExpenseCategoryRecord, IExpenseCategoryRepository } from "../../domain/expense-category.repository";

export class DeactivateExpenseCategoryUseCase {
  constructor(private readonly repo: IExpenseCategoryRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<ExpenseCategoryRecord> {
    const category = await this.repo.deactivate(id);

    await this.audit.record({
      action: "EXPENSE_CATEGORY_DEACTIVATED",
      entityType: "ExpenseCategory",
      entityId: category.id,
      description: `Categoria de gasto desactivada: ${category.code} ${category.name}`,
    });

    return category;
  }
}
