import type { AuditService } from "../../../audit/application/audit.service";
import type {
  ExpenseCategoryRecord,
  IExpenseCategoryRepository,
  UpdateExpenseCategoryData,
} from "../../domain/expense-category.repository";

export class UpdateExpenseCategoryUseCase {
  constructor(private readonly repo: IExpenseCategoryRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdateExpenseCategoryData): Promise<ExpenseCategoryRecord> {
    const category = await this.repo.update(id, data);

    await this.audit.record({
      action: "EXPENSE_CATEGORY_UPDATED",
      entityType: "ExpenseCategory",
      entityId: category.id,
      description: `Categoria de gasto actualizada: ${category.code} ${category.name} (cuenta ${category.accountCode})`,
    });

    return category;
  }
}
