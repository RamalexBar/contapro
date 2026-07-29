import type { NextFunction, Request, Response } from "express";
import type { ApproveTimeOffUseCase } from "../application/use-cases/approve-time-off.use-case";
import type { RegisterAbsenceUseCase } from "../application/use-cases/register-absence.use-case";
import type { RejectTimeOffUseCase } from "../application/use-cases/reject-time-off.use-case";
import type { RequestLeavePermissionUseCase } from "../application/use-cases/request-leave-permission.use-case";
import type { RequestVacationUseCase } from "../application/use-cases/request-vacation.use-case";
import type { SubmitSickLeaveUseCase } from "../application/use-cases/submit-sick-leave.use-case";
import type { ITimeOffRepository } from "../domain/time-off.repository";
import {
  listTimeOffQuerySchema,
  registerAbsenceSchema,
  requestLeavePermissionSchema,
  requestVacationSchema,
  submitSickLeaveSchema,
} from "./time-off.validators";

export class TimeOffController {
  constructor(
    private readonly repo: ITimeOffRepository,
    private readonly requestVacationUseCase: RequestVacationUseCase,
    private readonly requestLeavePermissionUseCase: RequestLeavePermissionUseCase,
    private readonly registerAbsenceUseCase: RegisterAbsenceUseCase,
    private readonly submitSickLeaveUseCase: SubmitSickLeaveUseCase,
    private readonly approveTimeOffUseCase: ApproveTimeOffUseCase,
    private readonly rejectTimeOffUseCase: RejectTimeOffUseCase
  ) {}

  // ---- Vacaciones ----
  listVacations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listTimeOffQuerySchema.parse(req.query);
      res.json({ data: await this.repo.listVacations(query) });
    } catch (err) {
      next(err);
    }
  };

  requestVacation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = requestVacationSchema.parse(req.body);
      res.status(201).json(await this.requestVacationUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  approveVacation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.approveTimeOffUseCase.execute("vacation", req.params.id));
    } catch (err) {
      next(err);
    }
  };

  rejectVacation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.rejectTimeOffUseCase.execute("vacation", req.params.id));
    } catch (err) {
      next(err);
    }
  };

  // ---- Permisos ----
  listLeavePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listTimeOffQuerySchema.parse(req.query);
      res.json({ data: await this.repo.listLeavePermissions(query) });
    } catch (err) {
      next(err);
    }
  };

  requestLeavePermission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = requestLeavePermissionSchema.parse(req.body);
      res.status(201).json(await this.requestLeavePermissionUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  approveLeavePermission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.approveTimeOffUseCase.execute("leave-permission", req.params.id));
    } catch (err) {
      next(err);
    }
  };

  rejectLeavePermission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.rejectTimeOffUseCase.execute("leave-permission", req.params.id));
    } catch (err) {
      next(err);
    }
  };

  // ---- Ausencias ----
  listAbsences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listTimeOffQuerySchema.parse(req.query);
      res.json({ data: await this.repo.listAbsences(query) });
    } catch (err) {
      next(err);
    }
  };

  registerAbsence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerAbsenceSchema.parse(req.body);
      res.status(201).json(await this.registerAbsenceUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  // ---- Incapacidades ----
  listSickLeaves = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listTimeOffQuerySchema.parse(req.query);
      res.json({ data: await this.repo.listSickLeaves(query) });
    } catch (err) {
      next(err);
    }
  };

  submitSickLeave = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = submitSickLeaveSchema.parse(req.body);
      res.status(201).json(await this.submitSickLeaveUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  approveSickLeave = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.approveTimeOffUseCase.execute("sick-leave", req.params.id));
    } catch (err) {
      next(err);
    }
  };

  rejectSickLeave = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.rejectTimeOffUseCase.execute("sick-leave", req.params.id));
    } catch (err) {
      next(err);
    }
  };
}
