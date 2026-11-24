import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { PrismaSaleRepository } from "../sale/infrastructure/prisma-sale.repository";
import { generateElectronicDebitNoteUseCase } from "../../electronic-invoicing/electronic-invoicing.container";
import { PrismaDebitNoteRepository } from "./infrastructure/prisma-debit-note.repository";
import { CreateDebitNoteUseCase } from "./application/use-cases/create-debit-note.use-case";
import { ListDebitNotesUseCase } from "./application/use-cases/list-debit-notes.use-case";
import { DebitNoteController } from "./interfaces/debit-note.controller";

// Instancia propia (repo sin estado), mismo criterio que return.container.ts.
const saleRepo = new PrismaSaleRepository();
const repo = new PrismaDebitNoteRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const debitNoteController = new DebitNoteController(
  new CreateDebitNoteUseCase(repo, saleRepo, generateElectronicDebitNoteUseCase, auditService),
  new ListDebitNotesUseCase(repo)
);
