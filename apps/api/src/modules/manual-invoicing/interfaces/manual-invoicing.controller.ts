import type { NextFunction, Request, Response } from "express";
import type { CreateManualInvoiceUseCase } from "../application/use-cases/create-manual-invoice.use-case";
import type { GetManualInvoiceUseCase } from "../application/use-cases/get-manual-invoice.use-case";
import type { ListManualInvoicesUseCase } from "../application/use-cases/list-manual-invoices.use-case";
import { createManualInvoiceSchema } from "./manual-invoicing.validators";

export class ManualInvoicingController {
  constructor(
    private readonly createUseCase: CreateManualInvoiceUseCase,
    private readonly getUseCase: GetManualInvoiceUseCase,
    private readonly listUseCase: ListManualInvoicesUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createManualInvoiceSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };
}
