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

/** Usado tambien por sync.container.ts para aplicar movimientos de caja encolados offline desde
 * el movil (item 42 de docs/ALCANCE.md) -- mismo caso de uso que POST /cash/sessions/:id/movements. */
export const registerCashMovementUseCase = new RegisterCashMovementUseCase(repo, auditService);

export const cashSessionController = new CashSessionController(
  new OpenCashSessionUseCase(repo, auditService),
  new CloseCashSessionUseCase(repo, postCashSessionAdjustmentJournalEntryUseCase, auditService),
  new GetActiveSessionUseCase(repo),
  registerCashMovementUseCase
);
