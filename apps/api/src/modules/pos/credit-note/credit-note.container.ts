import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { PrismaSaleRepository } from "../sale/infrastructure/prisma-sale.repository";
import { generateElectronicCreditNoteUseCase } from "../../electronic-invoicing/electronic-invoicing.container";
import { postNoteJournalEntryUseCase } from "../../accounting/accounting.container";
import { PrismaCreditNoteRepository } from "./infrastructure/prisma-credit-note.repository";
import { CreateCreditNoteUseCase } from "./application/use-cases/create-credit-note.use-case";
import { ListCreditNotesUseCase } from "./application/use-cases/list-credit-notes.use-case";
import { CreditNoteController } from "./interfaces/credit-note.controller";

// Instancia propia (repo sin estado), mismo criterio que return.container.ts.
const saleRepo = new PrismaSaleRepository();
const repo = new PrismaCreditNoteRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

/** Exportado: return.container.ts lo usa para emitir la nota credito de cada devolucion. */
export const createCreditNoteUseCase = new CreateCreditNoteUseCase(repo, saleRepo, generateElectronicCreditNoteUseCase, auditService, postNoteJournalEntryUseCase);

export const creditNoteController = new CreditNoteController(
  createCreditNoteUseCase,
  new ListCreditNotesUseCase(repo)
);
