import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { OpenCashSessionUseCase } from "../application/use-cases/open-session.use-case";
import type { CloseCashSessionUseCase } from "../application/use-cases/close-session.use-case";
import type { GetActiveSessionUseCase } from "../application/use-cases/get-active-session.use-case";
import type { RegisterCashMovementUseCase } from "../application/use-cases/register-cash-movement.use-case";
import { cashMovementSchema, closeCashSessionSchema, openCashSessionSchema } from "./cash-session.validators";

export class CashSessionController {
  constructor(
    private readonly openUseCase: OpenCashSessionUseCase,
    private readonly closeUseCase: CloseCashSessionUseCase,
    private readonly getActiveUseCase: GetActiveSessionUseCase,
    private readonly registerMovementUseCase: RegisterCashMovementUseCase
  ) {}

  open = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = openCashSessionSchema.parse(req.body);
      res.status(201).json(await this.openUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  close = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = closeCashSessionSchema.parse(req.body);
      res.json(await this.closeUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  listRegisters = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      const registers = await prisma.cashRegister.findMany({ where: { branchId: ctx.branchId ?? undefined, isActive: true } });
      res.json({ data: registers });
    } catch (err) {
      next(err);
    }
  };

  getActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getActiveUseCase.execute(req.params.cashRegisterId));
    } catch (err) {
      next(err);
    }
  };

  registerMovement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = cashMovementSchema.parse(req.body);
      await this.registerMovementUseCase.execute(req.params.id, body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
