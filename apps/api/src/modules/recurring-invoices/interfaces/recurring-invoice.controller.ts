import type { NextFunction, Request, Response } from "express";
import { createRecurringInvoiceSchema, updateRecurringInvoiceSchema } from "./recurring-invoice.validators";
import type { CreateRecurringInvoiceUseCase } from "../application/use-cases/create-recurring-invoice.use-case";
import type { UpdateRecurringInvoiceUseCase } from "../application/use-cases/update-recurring-invoice.use-case";
import type { DeactivateRecurringInvoiceUseCase } from "../application/use-cases/deactivate-recurring-invoice.use-case";
import type { ListRecurringInvoicesUseCase } from "../application/use-cases/list-recurring-invoices.use-case";
import type { ListRecurringInvoiceRunsUseCase } from "../application/use-cases/list-recurring-invoice-runs.use-case";

export class RecurringInvoiceController {
  constructor(
    private readonly createUseCase: CreateRecurringInvoiceUseCase,
    private readonly updateUseCase: UpdateRecurringInvoiceUseCase,
    private readonly deactivateUseCase: DeactivateRecurringInvoiceUseCase,
    private readonly listUseCase: ListRecurringInvoicesUseCase,
    private readonly listRunsUseCase: ListRecurringInvoiceRunsUseCase
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createRecurringInvoiceSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateRecurringInvoiceSchema.parse(req.body);
      res.json(await this.updateUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.deactivateUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  listRuns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listRunsUseCase.execute(req.params.id) });
    } catch (err) {
      next(err);
    }
  };
}
