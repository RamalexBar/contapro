import type { AuditService } from "../../../audit/application/audit.service";
import type {
  CreateExpenseCategoryData,
  ExpenseCategoryRecord,
  IExpenseCategoryRepository,
} from "../../domain/expense-category.repository";

export class CreateExpenseCategoryUseCase {
  constructor(private readonly repo: IExpenseCategoryRepository, private readonly audit: AuditService) {}

  async execute(data: CreateExpenseCategoryData): Promise<ExpenseCategoryRecord> {
    const category = await this.repo.create(data);

    await this.audit.record({
      action: "EXPENSE_CATEGORY_CREATED",
      entityType: "ExpenseCategory",
      entityId: category.id,
      description: `Categoria de gasto creada: ${category.code} ${category.name} (cuenta ${category.accountCode})`,
    });

    return category;
  }
}
