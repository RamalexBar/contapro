import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postExpenseJournalEntryUseCase, voidJournalEntryUseCase, costCenterRepository } from "../accounting/accounting.container";
import { PrismaExpenseCategoryRepository } from "./infrastructure/prisma-expense-category.repository";
import { PrismaExpenseRepository } from "./infrastructure/prisma-expense.repository";
import { CreateExpenseCategoryUseCase } from "./application/use-cases/create-expense-category.use-case";
import { UpdateExpenseCategoryUseCase } from "./application/use-cases/update-expense-category.use-case";
import { DeactivateExpenseCategoryUseCase } from "./application/use-cases/deactivate-expense-category.use-case";
import { ListExpenseCategoriesUseCase } from "./application/use-cases/list-expense-categories.use-case";
import { CreateExpenseUseCase } from "./application/use-cases/create-expense.use-case";
import { CancelExpenseUseCase } from "./application/use-cases/cancel-expense.use-case";
import { ListExpensesUseCase } from "./application/use-cases/list-expenses.use-case";
import { ExpensesController } from "./interfaces/expenses.controller";

const categoryRepo = new PrismaExpenseCategoryRepository();
const expenseRepo = new PrismaExpenseRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const expensesController = new ExpensesController(
  new CreateExpenseCategoryUseCase(categoryRepo, auditService),
  new UpdateExpenseCategoryUseCase(categoryRepo, auditService),
  new DeactivateExpenseCategoryUseCase(categoryRepo, auditService),
  new ListExpenseCategoriesUseCase(categoryRepo),
  new CreateExpenseUseCase(expenseRepo, categoryRepo, postExpenseJournalEntryUseCase, costCenterRepository, auditService),
  new CancelExpenseUseCase(expenseRepo, voidJournalEntryUseCase, auditService),
  new ListExpensesUseCase(expenseRepo)
);
