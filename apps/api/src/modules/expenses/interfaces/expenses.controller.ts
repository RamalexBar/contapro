import type { NextFunction, Request, Response } from "express";
import { getTenantContext } from "../../../shared/context/request-context";
import type { CreateExpenseCategoryUseCase } from "../application/use-cases/create-expense-category.use-case";
import type { UpdateExpenseCategoryUseCase } from "../application/use-cases/update-expense-category.use-case";
import type { DeactivateExpenseCategoryUseCase } from "../application/use-cases/deactivate-expense-category.use-case";
import type { ListExpenseCategoriesUseCase } from "../application/use-cases/list-expense-categories.use-case";
import type { CreateExpenseUseCase } from "../application/use-cases/create-expense.use-case";
import type { CancelExpenseUseCase } from "../application/use-cases/cancel-expense.use-case";
import type { ListExpensesUseCase } from "../application/use-cases/list-expenses.use-case";
import { createExpenseCategorySchema, createExpenseSchema, updateExpenseCategorySchema } from "./expenses.validators";

export class ExpensesController {
  constructor(
    private readonly createCategoryUseCase: CreateExpenseCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateExpenseCategoryUseCase,
    private readonly deactivateCategoryUseCase: DeactivateExpenseCategoryUseCase,
    private readonly listCategoriesUseCase: ListExpenseCategoriesUseCase,
    private readonly createExpenseUseCase: CreateExpenseUseCase,
    private readonly cancelExpenseUseCase: CancelExpenseUseCase,
    private readonly listExpensesUseCase: ListExpensesUseCase
  ) {}

  listCategories = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listCategoriesUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createExpenseCategorySchema.parse(req.body);
      res.status(201).json(await this.createCategoryUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateExpenseCategorySchema.parse(req.body);
      res.json(await this.updateCategoryUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  deactivateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.deactivateCategoryUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  listExpenses = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listExpensesUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  createExpense = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createExpenseSchema.parse(req.body);
      const createdByUserId = getTenantContext().userId;
      res.status(201).json(await this.createExpenseUseCase.execute({ ...body, createdByUserId }));
    } catch (err) {
      next(err);
    }
  };

  cancelExpense = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.cancelExpenseUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };
}
