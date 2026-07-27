import type { NextFunction, Request, Response } from "express";
import { createBrandSchema } from "@erp/shared-types";
import type { CreateBrandUseCase } from "../application/use-cases/create-brand.use-case";
import type { ListBrandsUseCase } from "../application/use-cases/list-brands.use-case";

export class BrandController {
  constructor(private readonly createUseCase: CreateBrandUseCase, private readonly listUseCase: ListBrandsUseCase) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createBrandSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body.name));
    } catch (err) {
      next(err);
    }
  };
}
