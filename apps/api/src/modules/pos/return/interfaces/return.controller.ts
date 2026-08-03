import type { NextFunction, Request, Response } from "express";
import type { CreateReturnUseCase } from "../application/use-cases/create-return.use-case";
import type { ListReturnsUseCase } from "../application/use-cases/list-returns.use-case";
import { createReturnSchema, listReturnsQuerySchema } from "./return.validators";

export class ReturnController {
  constructor(
    private readonly createUseCase: CreateReturnUseCase,
    private readonly listUseCase: ListReturnsUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createReturnSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listReturnsQuerySchema.parse(req.query);
      res.json({ data: await this.listUseCase.execute(query) });
    } catch (err) {
      next(err);
    }
  };
}
