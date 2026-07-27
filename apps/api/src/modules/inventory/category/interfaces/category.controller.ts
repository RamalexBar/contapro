import type { NextFunction, Request, Response } from "express";
import { createCategorySchema } from "@erp/shared-types";
import type { CreateCategoryUseCase } from "../application/use-cases/create-category.use-case";
import type { ListCategoriesUseCase } from "../application/use-cases/list-categories.use-case";

export class CategoryController {
  constructor(
    private readonly createUseCase: CreateCategoryUseCase,
    private readonly listUseCase: ListCategoriesUseCase
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
      const body = createCategorySchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body.name, body.parentId));
    } catch (err) {
      next(err);
    }
  };
}
