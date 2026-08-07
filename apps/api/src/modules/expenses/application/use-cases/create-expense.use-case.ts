import { round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostExpenseJournalEntryUseCase } from "../../../accounting/application/use-cases/post-expense-journal-entry.use-case";
import type { ICostCenterRepository } from "../../../accounting/domain/cost-center.repository";
import type { CreateExpenseData, ExpenseRecord, IExpenseRepository } from "../../domain/expense.repository";
import type { IExpenseCategoryRepository } from "../../domain/expense-category.repository";

/**
 * Registro de un gasto operativo: se paga completo de una vez (sin cuentas por pagar de gastos,
 * ver decision de alcance en el plan del item 30), se contabiliza en el mismo momento --
 * analogo a CreatePurchaseUseCase pero sin AccountPayable ni documento soporte electronico.
 */
export class CreateExpenseUseCase {
  constructor(
    private readonly expenseRepo: IExpenseRepository,
    private readonly categoryRepo: IExpenseCategoryRepository,
    private readonly postExpenseJournalEntry: PostExpenseJournalEntryUseCase,
    private readonly costCenterRepo: ICostCenterRepository,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreateExpenseData): Promise<ExpenseRecord> {
    const category = await this.categoryRepo.findByIdOrThrow(data.expenseCategoryId);
    if (!category.isActive) {
      throw new ValidationError(`La categoria de gasto ${category.code} esta inactiva`);
    }

    if (data.costCenterId) {
      const costCenter = await this.costCenterRepo.findByIdOrThrow(data.costCenterId);
      if (!costCenter.isActive) {
        throw new ValidationError(`El centro de costo ${costCenter.code} ${costCenter.name} esta inactivo`);
      }
    }

    const expectedTotal = round2(data.subtotal + data.taxTotal);
    if (expectedTotal !== round2(data.total)) {
      throw new ValidationError(`El total (${data.total}) no coincide con subtotal + IVA (${expectedTotal})`);
    }

    const expense = await this.expenseRepo.create(data);

    await this.audit.record({
      action: "EXPENSE_REGISTERED",
      entityType: "Expense",
      entityId: expense.id,
      description: `Gasto registrado: ${expense.payeeName} (${category.name}) por ${expense.total}`,
    });

    const journalEntry = await this.postExpenseJournalEntry.execute({
      expenseId: expense.id,
      branchId: expense.branchId,
      date: expense.date,
      payeeName: expense.payeeName,
      subtotal: expense.subtotal,
      taxTotal: expense.taxTotal,
      total: expense.total,
      paymentMethod: expense.paymentMethod,
      expenseAccountCode: category.accountCode,
      expenseAccountName: category.name,
      costCenterId: expense.costCenterId ?? undefined,
    });
    if (journalEntry) {
      await this.expenseRepo.setJournalEntryId(expense.id, journalEntry.id);
      expense.journalEntryId = journalEntry.id;
    }

    return expense;
  }
}
