import type { NextFunction, Request, Response } from "express";
import type { CreateCustomerUseCase } from "../application/use-cases/create-customer.use-case";
import type { ListCustomersUseCase } from "../application/use-cases/list-customers.use-case";
import type { UpdateCustomerPriceListUseCase } from "../application/use-cases/update-customer-price-list.use-case";
import { createCustomerSchema, updateCustomerPriceListSchema } from "./customer.validators";

export class CustomerController {
  constructor(
    private readonly createUseCase: CreateCustomerUseCase,
    private readonly listUseCase: ListCustomersUseCase,
    private readonly updatePriceListUseCase: UpdateCustomerPriceListUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createCustomerSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json({ data: await this.listUseCase.execute(search) });
    } catch (err) {
      next(err);
    }
  };

  updatePriceList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateCustomerPriceListSchema.parse(req.body);
      res.json(await this.updatePriceListUseCase.execute(req.params.id, body.priceListId));
    } catch (err) {
      next(err);
    }
  };
}
