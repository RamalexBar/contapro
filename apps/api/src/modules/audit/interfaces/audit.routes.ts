import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { PrismaAuditLogRepository } from "../infrastructure/prisma-audit-log.repository";
import { AuditController } from "./audit.controller";

const repo = new PrismaAuditLogRepository();
const controller = new AuditController(repo);

export const auditRouter = Router();
auditRouter.use(tenantContextMiddleware);

auditRouter.get("/audit-logs", requirePermission("audit.read"), controller.list);
