import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { generateElectronicCreditNoteUseCase } from "../../electronic-invoicing/electronic-invoicing.container";
import { PrismaCreditNoteRepository } from "./infrastructure/prisma-credit-note.repository";
import { CreateCreditNoteUseCase } from "./application/use-cases/create-credit-note.use-case";
import { ListCreditNotesUseCase } from "./application/use-cases/list-credit-notes.use-case";
import { CreditNoteController } from "./interfaces/credit-note.controller";

const repo = new PrismaCreditNoteRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const creditNoteController = new CreditNoteController(
  new CreateCreditNoteUseCase(repo, generateElectronicCreditNoteUseCase, auditService),
  new ListCreditNotesUseCase(repo)
);
