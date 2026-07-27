import type { NextFunction, Request, Response } from "express";
import type { CreateCustomerUseCase } from "../application/use-cases/create-customer.use-case";
import type { ListCustomersUseCase } from "../application/use-cases/list-customers.use-case";
import { createCustomerSchema } from "./customer.validators";

export class CustomerController {
  constructor(private readonly createUseCase: CreateCustomerUseCase, private readonly listUseCase: ListCustomersUseCase) {}

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
}
