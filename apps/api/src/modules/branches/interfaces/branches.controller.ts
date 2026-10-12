import type { NextFunction, Request, Response } from "express";
import { createBranchSchema, updateBranchSchema } from "@erp/shared-types";
import type { CreateBranchUseCase } from "../application/use-cases/create-branch.use-case";
import type { ListBranchesUseCase } from "../application/use-cases/list-branches.use-case";
import type { UpdateBranchUseCase } from "../application/use-cases/update-branch.use-case";

export class BranchesController {
  constructor(
    private readonly createUseCase: CreateBranchUseCase,
    private readonly listUseCase: ListBranchesUseCase,
    private readonly updateUseCase: UpdateBranchUseCase
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute({ includeInactive: req.query.includeInactive === "true" }) });
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

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateBranchSchema.parse(req.body);
      res.json(await this.updateUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };
}
