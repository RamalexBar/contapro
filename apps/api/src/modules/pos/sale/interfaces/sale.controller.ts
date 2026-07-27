import type { NextFunction, Request, Response } from "express";
import type { CreateSaleUseCase } from "../application/use-cases/create-sale.use-case";
import type { AuthorizeDiscountUseCase } from "../application/use-cases/authorize-discount.use-case";
import type { CancelSaleUseCase } from "../application/use-cases/cancel-sale.use-case";
import type { GetSaleUseCase } from "../application/use-cases/get-sale.use-case";
import type { ListSalesUseCase } from "../application/use-cases/list-sales.use-case";
import { authorizeDiscountSchema, cancelSaleSchema, createSaleSchema } from "./sale.validators";

export class SaleController {
  constructor(
    private readonly createUseCase: CreateSaleUseCase,
    private readonly authorizeDiscountUseCase: AuthorizeDiscountUseCase,
    private readonly cancelUseCase: CancelSaleUseCase,
    private readonly getUseCase: GetSaleUseCase,
    private readonly listUseCase: ListSalesUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSaleSchema.parse(req.body);
      const sale = await this.createUseCase.execute(body);
      res.status(sale.status === "PENDING_AUTHORIZATION" ? 202 : 201).json(sale);
    } catch (err) {
      next(err);
    }
  };

  authorizeDiscount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = authorizeDiscountSchema.parse(req.body);
      res.json(await this.authorizeDiscountUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = cancelSaleSchema.parse(req.body);
      res.json(await this.cancelUseCase.execute(req.params.id, body.reason));
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const take = req.query.take ? Number(req.query.take) : undefined;
      const skip = req.query.skip ? Number(req.query.skip) : undefined;
      res.json({ data: await this.listUseCase.execute(take, skip) });
    } catch (err) {
      next(err);
    }
  };
}
