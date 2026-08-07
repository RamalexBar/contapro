import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { VoidJournalEntryUseCase } from "../../../accounting/application/use-cases/void-journal-entry.use-case";
import type { ExpenseRecord, IExpenseRepository } from "../../domain/expense.repository";

/**
 * Cancelar un gasto: mas simple que CancelPurchaseUseCase porque no hay abonos que reversar (un
 * gasto se paga completo al registrarse) -- solo anula el comprobante contable y marca CANCELLED.
 */
export class CancelExpenseUseCase {
  constructor(
    private readonly expenseRepo: IExpenseRepository,
    private readonly voidJournalEntry: VoidJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(id: string): Promise<ExpenseRecord> {
    const expense = await this.expenseRepo.findByIdOrThrow(id);
    if (expense.status === "CANCELLED") {
      throw new ValidationError("Este gasto ya esta cancelado");
    }

    const updated = await this.expenseRepo.cancel(id);

    if (expense.journalEntryId) {
      await this.voidJournalEntry.execute(expense.journalEntryId);
    }

    await this.audit.record({
      action: "EXPENSE_CANCELLED",
      entityType: "Expense",
      entityId: id,
      description: `Gasto cancelado: ${expense.payeeName} por ${expense.total}`,
    });

    return updated;
  }
}
