import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { generateElectronicDebitNoteUseCase } from "../../electronic-invoicing/electronic-invoicing.container";
import { PrismaDebitNoteRepository } from "./infrastructure/prisma-debit-note.repository";
import { CreateDebitNoteUseCase } from "./application/use-cases/create-debit-note.use-case";
import { ListDebitNotesUseCase } from "./application/use-cases/list-debit-notes.use-case";
import { DebitNoteController } from "./interfaces/debit-note.controller";

const repo = new PrismaDebitNoteRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const debitNoteController = new DebitNoteController(
  new CreateDebitNoteUseCase(repo, generateElectronicDebitNoteUseCase, auditService),
  new ListDebitNotesUseCase(repo)
);
