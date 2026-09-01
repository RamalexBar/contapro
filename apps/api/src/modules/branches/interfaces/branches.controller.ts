import type { NextFunction, Request, Response } from "express";
import { createBranchSchema } from "@erp/shared-types";
import type { CreateBranchUseCase } from "../application/use-cases/create-branch.use-case";
import type { ListBranchesUseCase } from "../application/use-cases/list-branches.use-case";

export class BranchesController {
  constructor(
    private readonly createUseCase: CreateBranchUseCase,
    private readonly listUseCase: ListBranchesUseCase
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
      const body = createBranchSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };
}
