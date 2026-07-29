import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaChartOfAccountsRepository } from "./infrastructure/prisma-chart-of-accounts.repository";
import { PrismaJournalEntryRepository } from "./infrastructure/prisma-journal-entry.repository";
import { AccountingReportsService } from "./application/accounting-reports.service";
import { CreateAccountUseCase } from "./application/use-cases/create-account.use-case";
import { CreateJournalEntryUseCase } from "./application/use-cases/create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./application/use-cases/post-journal-entry.use-case";
import { VoidJournalEntryUseCase } from "./application/use-cases/void-journal-entry.use-case";
import { PostPayrollJournalEntryUseCase } from "./application/use-cases/post-payroll-journal-entry.use-case";
import { AccountingController } from "./interfaces/accounting.controller";

const accountRepo = new PrismaChartOfAccountsRepository();
const journalRepo = new PrismaJournalEntryRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const reports = new AccountingReportsService(journalRepo, accountRepo);

const createAccountUseCase = new CreateAccountUseCase(accountRepo, auditService);
const createEntryUseCase = new CreateJournalEntryUseCase(journalRepo, accountRepo, auditService);
const postEntryUseCase = new PostJournalEntryUseCase(journalRepo, auditService);
const voidEntryUseCase = new VoidJournalEntryUseCase(journalRepo, auditService);

export const accountingController = new AccountingController(
  accountRepo,
  journalRepo,
  reports,
  createAccountUseCase,
  createEntryUseCase,
  postEntryUseCase,
  voidEntryUseCase
);

/** Usado por payroll.container.ts para generar el comprobante de nomina al aprobar un periodo. */
export const postPayrollJournalEntryUseCase = new PostPayrollJournalEntryUseCase(
  accountRepo,
  createEntryUseCase,
  postEntryUseCase
);
