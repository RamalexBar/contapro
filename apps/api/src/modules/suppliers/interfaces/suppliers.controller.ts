import type { NextFunction, Request, Response } from "express";
import type { CreateSupplierUseCase } from "../application/use-cases/create-supplier.use-case";
import type { ListSuppliersUseCase } from "../application/use-cases/list-suppliers.use-case";
import type { CreatePurchaseUseCase } from "../application/use-cases/create-purchase.use-case";
import { createPurchaseSchema, createSupplierSchema } from "./suppliers.validators";

export class SuppliersController {
  constructor(
    private readonly createSupplierUseCase: CreateSupplierUseCase,
    private readonly listSuppliersUseCase: ListSuppliersUseCase,
    private readonly createPurchaseUseCase: CreatePurchaseUseCase
  ) {}

  createSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSupplierSchema.parse(req.body);
      res.status(201).json(await this.createSupplierUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json({ data: await this.listSuppliersUseCase.execute(search) });
    } catch (err) {
      next(err);
    }
  };

  createPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPurchaseSchema.parse(req.body);
      res.status(201).json(await this.createPurchaseUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };
}
