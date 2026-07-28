import type { NextFunction, Request, Response } from "express";
import type { CreateEmployeeUseCase } from "../application/use-cases/create-employee.use-case";
import type { ListEmployeesUseCase } from "../application/use-cases/list-employees.use-case";
import type { UpdateEmployeeUseCase } from "../application/use-cases/update-employee.use-case";
import type { DeactivateEmployeeUseCase } from "../application/use-cases/deactivate-employee.use-case";
import type { IEmployeeRepository } from "../domain/employee.repository";
import { createEmployeeSchema, deactivateEmployeeSchema, updateEmployeeSchema } from "./employee.validators";

export class EmployeeController {
  constructor(
    private readonly repo: IEmployeeRepository,
    private readonly createUseCase: CreateEmployeeUseCase,
    private readonly listUseCase: ListEmployeesUseCase,
    private readonly updateUseCase: UpdateEmployeeUseCase,
    private readonly deactivateUseCase: DeactivateEmployeeUseCase
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json({ data: await this.listUseCase.execute({ branchId, status }) });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.repo.findByIdOrThrow(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createEmployeeSchema.parse(req.body);
      const employee = await this.createUseCase.execute(body);
      res.status(201).json(employee);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateEmployeeSchema.parse(req.body);
      res.json(await this.updateUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = deactivateEmployeeSchema.parse(req.body);
      res.json(await this.deactivateUseCase.execute(req.params.id, body.terminationDate));
    } catch (err) {
      next(err);
    }
  };
}
