import type { NextFunction, Request, Response } from "express";
import { createQuoteSchema } from "@erp/shared-types";
import type { CreateQuoteUseCase } from "../application/use-cases/create-quote.use-case";
import type { ListQuotesUseCase } from "../application/use-cases/list-quotes.use-case";

export class QuoteController {
  constructor(private readonly createUseCase: CreateQuoteUseCase, private readonly listUseCase: ListQuotesUseCase) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createQuoteSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
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
