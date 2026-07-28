import type { NextFunction, Request, Response } from "express";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { IEmployeeRepository } from "../../employees/domain/employee.repository";
import type { ClockInUseCase } from "../application/use-cases/clock-in.use-case";
import type { ClockOutUseCase } from "../application/use-cases/clock-out.use-case";
import type { ListTimeEntriesUseCase } from "../application/use-cases/list-time-entries.use-case";
import type { ITimeTrackingRepository } from "../domain/timetracking.repository";
import { clockInSchema, clockOutSchema, listTimeEntriesQuerySchema } from "./timetracking.validators";

export class TimeTrackingController {
  constructor(
    private readonly clockInUseCase: ClockInUseCase,
    private readonly clockOutUseCase: ClockOutUseCase,
    private readonly listUseCase: ListTimeEntriesUseCase,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly timeTrackingRepo: ITimeTrackingRepository
  ) {}

  clockIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = clockInSchema.parse(req.body);
      res.status(201).json(await this.clockInUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  clockOut = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = clockOutSchema.parse(req.body);
      res.json(await this.clockOutUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listTimeEntriesQuerySchema.parse(req.query);
      res.json({ data: await this.listUseCase.execute(query) });
    } catch (err) {
      next(err);
    }
  };

  /** Entrada abierta del empleado vinculado al usuario autenticado (self-service). */
  myOpenEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      const employee = await this.employeeRepo.findByUserId(ctx.userId);
      if (!employee) throw new NotFoundError("Employee");
      res.json(await this.timeTrackingRepo.findOpenEntry(employee.id));
    } catch (err) {
      next(err);
    }
  };
}
