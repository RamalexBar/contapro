import type { Request, Response, NextFunction } from "express";
import { getTenantContext } from "../../../shared/context/request-context";
import type { IAuditLogRepository } from "../domain/audit-log.repository";

export class AuditController {
  constructor(private readonly repo: IAuditLogRepository) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      const logs = await this.repo.list({
        companyId: ctx.companyId,
        entityType: typeof req.query.entityType === "string" ? req.query.entityType : undefined,
        entityId: typeof req.query.entityId === "string" ? req.query.entityId : undefined,
        action: typeof req.query.action === "string" ? req.query.action : undefined,
        take: req.query.take ? Number(req.query.take) : undefined,
        skip: req.query.skip ? Number(req.query.skip) : undefined,
      });
      res.json({ data: logs });
    } catch (err) {
      next(err);
    }
  };
}
