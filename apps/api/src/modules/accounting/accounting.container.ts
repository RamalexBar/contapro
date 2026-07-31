import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
// Instancia propia, no importada de cash-session.container.ts: ese container importa
// postCashSessionAdjustmentJournalEntryUseCase de aqui, importar en la otra direccion crearia un
// ciclo de modulos. PrismaCashSessionRepository no tiene estado propio, instanciarla dos veces es
// segura (mismo criterio ya usado con PrismaSupplierRepository en electronic-invoicing.container.ts).
import { PrismaCashSessionRepository } from "../cash/cash-session/infrastructure/prisma-cash-session.repository";
import { PrismaChartOfAccountsRepository } from "./infrastructure/prisma-chart-of-accounts.repository";
import { PrismaJournalEntryRepository } from "./infrastructure/prisma-journal-entry.repository";
import { PrismaBankAccountRepository } from "./infrastructure/prisma-bank-account.repository";
import { PrismaBankTransactionRepository } from "./infrastructure/prisma-bank-transaction.repository";
import { PrismaBankReconciliationRepository } from "./infrastructure/prisma-bank-reconciliation.repository";
import { AccountingReportsService } from "./application/accounting-reports.service";
import { CreateAccountUseCase } from "./application/use-cases/create-account.use-case";
import { CreateJournalEntryUseCase } from "./application/use-cases/create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./application/use-cases/post-journal-entry.use-case";
import { VoidJournalEntryUseCase } from "./application/use-cases/void-journal-entry.use-case";
import { PostPayrollJournalEntryUseCase } from "./application/use-cases/post-payroll-journal-entry.use-case";
import { PostSaleJournalEntryUseCase } from "./application/use-cases/post-sale-journal-entry.use-case";
import { PostPurchaseJournalEntryUseCase } from "./application/use-cases/post-purchase-journal-entry.use-case";
import { PostSupplierPaymentJournalEntryUseCase } from "./application/use-cases/post-supplier-payment-journal-entry.use-case";
import { PostCashSessionAdjustmentJournalEntryUseCase } from "./application/use-cases/post-cash-session-adjustment-journal-entry.use-case";
import { CreateBankAccountUseCase } from "./application/use-cases/create-bank-account.use-case";
import { ListBankAccountsUseCase } from "./application/use-cases/list-bank-accounts.use-case";
import { RegisterBankTransactionUseCase } from "./application/use-cases/register-bank-transaction.use-case";
import { ListBankTransactionsUseCase } from "./application/use-cases/list-bank-transactions.use-case";
import { StartBankReconciliationUseCase } from "./application/use-cases/start-bank-reconciliation.use-case";
import { MatchBankReconciliationItemUseCase } from "./application/use-cases/match-bank-reconciliation-item.use-case";
import { CloseBankReconciliationUseCase } from "./application/use-cases/close-bank-reconciliation.use-case";
import { GetBankReconciliationUseCase } from "./application/use-cases/get-bank-reconciliation.use-case";
import { ListBankReconciliationsUseCase } from "./application/use-cases/list-bank-reconciliations.use-case";
import { AccountingController } from "./interfaces/accounting.controller";

const accountRepo = new PrismaChartOfAccountsRepository();
const journalRepo = new PrismaJournalEntryRepository();
const cashSessionRepo = new PrismaCashSessionRepository();
const bankAccountRepo = new PrismaBankAccountRepository();
const bankTransactionRepo = new PrismaBankTransactionRepository();
const bankReconciliationRepo = new PrismaBankReconciliationRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const reports = new AccountingReportsService(journalRepo, accountRepo, cashSessionRepo, bankTransactionRepo);

const createAccountUseCase = new CreateAccountUseCase(accountRepo, auditService);
const createEntryUseCase = new CreateJournalEntryUseCase(journalRepo, accountRepo, auditService);
const postEntryUseCase = new PostJournalEntryUseCase(journalRepo, auditService);

/** Usado tambien por suppliers.container.ts (CancelPurchaseUseCase) para anular el comprobante de
 * una compra cancelada -- operacion generica, no especifica de ningun modulo. */
export const voidJournalEntryUseCase = new VoidJournalEntryUseCase(journalRepo, auditService);

export const accountingController = new AccountingController(
  accountRepo,
  journalRepo,
  reports,
  createAccountUseCase,
  createEntryUseCase,
  postEntryUseCase,
  voidJournalEntryUseCase,
  new CreateBankAccountUseCase(bankAccountRepo, auditService),
  new ListBankAccountsUseCase(bankAccountRepo),
  new RegisterBankTransactionUseCase(bankTransactionRepo, bankAccountRepo, auditService),
  new ListBankTransactionsUseCase(bankTransactionRepo, bankAccountRepo),
  new StartBankReconciliationUseCase(bankReconciliationRepo, bankAccountRepo, auditService),
  new MatchBankReconciliationItemUseCase(bankReconciliationRepo, auditService),
  new CloseBankReconciliationUseCase(bankReconciliationRepo, auditService),
  new GetBankReconciliationUseCase(bankReconciliationRepo),
  new ListBankReconciliationsUseCase(bankReconciliationRepo)
);

/** Usado por payroll.container.ts para generar el comprobante de nomina al aprobar un periodo. */
export const postPayrollJournalEntryUseCase = new PostPayrollJournalEntryUseCase(
  accountRepo,
  createEntryUseCase,
  postEntryUseCase
);

/** Usado por sale.container.ts para contabilizar una venta al completarse. */
export const postSaleJournalEntryUseCase = new PostSaleJournalEntryUseCase(accountRepo, createEntryUseCase, postEntryUseCase);

/** Usado por suppliers.container.ts para contabilizar una compra al registrarse. */
export const postPurchaseJournalEntryUseCase = new PostPurchaseJournalEntryUseCase(
  accountRepo,
  createEntryUseCase,
  postEntryUseCase
);

/** Usado por suppliers.container.ts para contabilizar un abono a proveedor. */
export const postSupplierPaymentJournalEntryUseCase = new PostSupplierPaymentJournalEntryUseCase(
  accountRepo,
  createEntryUseCase,
  postEntryUseCase
);

/** Usado por cash-session.container.ts para contabilizar la diferencia de un arqueo de caja. */
export const postCashSessionAdjustmentJournalEntryUseCase = new PostCashSessionAdjustmentJournalEntryUseCase(
  accountRepo,
  createEntryUseCase,
  postEntryUseCase
);
