import type { NextFunction, Request, Response } from "express";
import { getTenantContext } from "../../../shared/context/request-context";
import { ValidationError } from "../../../shared/errors/app-error";
import type { PushSyncEventsUseCase } from "../application/use-cases/push-sync-events.use-case";
import type { PullSyncChangesUseCase } from "../application/use-cases/pull-sync-changes.use-case";
import { pushSyncEventsSchema } from "./sync.validators";

export class SyncController {
  constructor(
    private readonly pushUseCase: PushSyncEventsUseCase,
    private readonly pullUseCase: PullSyncChangesUseCase
  ) {}

  push = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      if (!ctx.branchId) {
        throw new ValidationError("El dispositivo no tiene una sucursal activa (header x-branch-id)");
      }
      const body = pushSyncEventsSchema.parse(req.body);
      const results = await this.pushUseCase.execute({
        deviceIdentifier: body.deviceId,
        platform: body.platform,
        branchId: ctx.branchId,
        userId: ctx.userId,
        events: body.events,
      });
      res.json({ data: results });
    } catch (err) {
      next(err);
    }
  };

  pull = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const since = typeof req.query.since === "string" ? new Date(req.query.since) : null;
      res.json(await this.pullUseCase.execute(since));
    } catch (err) {
      next(err);
    }
  };
}
