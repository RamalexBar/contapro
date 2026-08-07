import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { expensesController } from "../expenses.container";

export const expensesRouter = Router();
expensesRouter.use(tenantContextMiddleware);

expensesRouter.get("/expense-categories", requirePermission("expense.read"), expensesController.listCategories);
expensesRouter.post("/expense-categories", requirePermission("expense.manage"), expensesController.createCategory);
expensesRouter.patch("/expense-categories/:id", requirePermission("expense.manage"), expensesController.updateCategory);
expensesRouter.post(
  "/expense-categories/:id/deactivate",
  requirePermission("expense.manage"),
  expensesController.deactivateCategory
);

expensesRouter.get("/expenses", requirePermission("expense.read"), expensesController.listExpenses);
expensesRouter.post("/expenses", requirePermission("expense.manage"), expensesController.createExpense);
expensesRouter.post("/expenses/:id/cancel", requirePermission("expense.manage"), expensesController.cancelExpense);
