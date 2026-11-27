import type { NextFunction, Request, Response } from "express";
import { createPayrollBonusSchema } from "@erp/shared-types";
import type {
  CancelPayrollBonusUseCase,
  CreatePayrollBonusUseCase,
  ListPayrollBonusesUseCase,
} from "../application/use-cases/payroll-bonus.use-cases";

export class PayrollBonusController {
  constructor(
    private readonly createUseCase: CreatePayrollBonusUseCase,
    private readonly listUseCase: ListPayrollBonusesUseCase,
    private readonly cancelUseCase: CancelPayrollBonusUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.createUseCase.execute(createPayrollBonusSchema.parse(req.body)));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
      res.json({ data: await this.listUseCase.execute({ employeeId }) });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.cancelUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };
}
