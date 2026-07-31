import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { postCashSessionAdjustmentJournalEntryUseCase } from "../../accounting/accounting.container";
import { PrismaCashSessionRepository } from "./infrastructure/prisma-cash-session.repository";
import { OpenCashSessionUseCase } from "./application/use-cases/open-session.use-case";
import { CloseCashSessionUseCase } from "./application/use-cases/close-session.use-case";
import { GetActiveSessionUseCase } from "./application/use-cases/get-active-session.use-case";
import { RegisterCashMovementUseCase } from "./application/use-cases/register-cash-movement.use-case";
import { CashSessionController } from "./interfaces/cash-session.controller";

const repo = new PrismaCashSessionRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const cashSessionController = new CashSessionController(
  new OpenCashSessionUseCase(repo, auditService),
  new CloseCashSessionUseCase(repo, postCashSessionAdjustmentJournalEntryUseCase, auditService),
  new GetActiveSessionUseCase(repo),
  new RegisterCashMovementUseCase(repo, auditService)
);
