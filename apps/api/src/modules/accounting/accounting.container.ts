import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
// Instancia propia, no importada de cash-session.container.ts: ese container importa
// postCashSessionAdjustmentJournalEntryUseCase de aqui, importar en la otra direccion crearia un
// ciclo de modulos. PrismaCashSessionRepository no tiene estado propio, instanciarla dos veces es
// segura (mismo criterio ya usado con PrismaSupplierRepository en electronic-invoicing.container.ts).
import { PrismaCashSessionRepository } from "../cash/cash-session/infrastructure/prisma-cash-session.repository";
import { PrismaChartOfAccountsRepository } from "./infrastructure/prisma-chart-of-accounts.repository";
import { PrismaJournalEntryRepository } from "./infrastructure/prisma-journal-entry.repository";
import { PrismaFinancialPeriodRepository } from "./infrastructure/prisma-financial-period.repository";
import { PrismaBankAccountRepository } from "./infrastructure/prisma-bank-account.repository";
import { PrismaBankTransactionRepository } from "./infrastructure/prisma-bank-transaction.repository";
import { PrismaBankReconciliationRepository } from "./infrastructure/prisma-bank-reconciliation.repository";
import { PrismaWithholdingConceptRepository } from "./infrastructure/prisma-withholding-concept.repository";
import { PrismaCostCenterRepository } from "./infrastructure/prisma-cost-center.repository";
import { PrismaCompanyReaderRepository } from "./infrastructure/prisma-company-reader.repository";
import { AccountingReportsService } from "./application/accounting-reports.service";
import { PrismaThirdPartyResolver } from "./infrastructure/prisma-third-party-resolver";
import { CreateAccountUseCase } from "./application/use-cases/create-account.use-case";
import { UpdateAccountUseCase } from "./application/use-cases/update-account.use-case";
import { SetAccountActiveUseCase } from "./application/use-cases/set-account-active.use-case";
import { CreateJournalEntryUseCase } from "./application/use-cases/create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./application/use-cases/post-journal-entry.use-case";
import { VoidJournalEntryUseCase } from "./application/use-cases/void-journal-entry.use-case";
import { PostPayrollJournalEntryUseCase } from "./application/use-cases/post-payroll-journal-entry.use-case";
import { PostSaleJournalEntryUseCase } from "./application/use-cases/post-sale-journal-entry.use-case";
import { PostReturnJournalEntryUseCase } from "./application/use-cases/post-return-journal-entry.use-case";
import { PostPurchaseJournalEntryUseCase } from "./application/use-cases/post-purchase-journal-entry.use-case";
import { PostSupplierPaymentJournalEntryUseCase } from "./application/use-cases/post-supplier-payment-journal-entry.use-case";
import { PostCashSessionAdjustmentJournalEntryUseCase } from "./application/use-cases/post-cash-session-adjustment-journal-entry.use-case";
import { PostExpenseJournalEntryUseCase } from "./application/use-cases/post-expense-journal-entry.use-case";
import { PostCommissionJournalEntryUseCase } from "./application/use-cases/post-commission-journal-entry.use-case";
import { PostDepreciationJournalEntryUseCase } from "./application/use-cases/post-depreciation-journal-entry.use-case";
import { PostReceivableCollectionJournalEntryUseCase } from "./application/use-cases/post-receivable-collection-journal-entry.use-case";
import { CreateBankAccountUseCase } from "./application/use-cases/create-bank-account.use-case";
import { ListBankAccountsUseCase } from "./application/use-cases/list-bank-accounts.use-case";
import { RegisterBankTransactionUseCase } from "./application/use-cases/register-bank-transaction.use-case";
import { ListBankTransactionsUseCase } from "./application/use-cases/list-bank-transactions.use-case";
import { StartBankReconciliationUseCase } from "./application/use-cases/start-bank-reconciliation.use-case";
import { MatchBankReconciliationItemUseCase } from "./application/use-cases/match-bank-reconciliation-item.use-case";
import { CloseBankReconciliationUseCase } from "./application/use-cases/close-bank-reconciliation.use-case";
import { GetBankReconciliationUseCase } from "./application/use-cases/get-bank-reconciliation.use-case";
import { ListBankReconciliationsUseCase } from "./application/use-cases/list-bank-reconciliations.use-case";
import { SuggestBankReconciliationMatchesUseCase } from "./application/use-cases/suggest-bank-reconciliation-matches.use-case";
import { CloseFinancialPeriodUseCase } from "./application/use-cases/close-financial-period.use-case";
import { ReopenFinancialPeriodUseCase } from "./application/use-cases/reopen-financial-period.use-case";
import { CreateWithholdingConceptUseCase } from "./application/use-cases/create-withholding-concept.use-case";
import { UpdateWithholdingConceptUseCase } from "./application/use-cases/update-withholding-concept.use-case";
import { DeactivateWithholdingConceptUseCase } from "./application/use-cases/deactivate-withholding-concept.use-case";
import { ListWithholdingConceptsUseCase } from "./application/use-cases/list-withholding-concepts.use-case";
import { CreateCostCenterUseCase } from "./application/use-cases/create-cost-center.use-case";
import { UpdateCostCenterUseCase } from "./application/use-cases/update-cost-center.use-case";
import { DeactivateCostCenterUseCase } from "./application/use-cases/deactivate-cost-center.use-case";
import { ListCostCentersUseCase } from "./application/use-cases/list-cost-centers.use-case";
import { AccountingController } from "./interfaces/accounting.controller";

const accountRepo = new PrismaChartOfAccountsRepository();
const journalRepo = new PrismaJournalEntryRepository();
const cashSessionRepo = new PrismaCashSessionRepository();
const bankAccountRepo = new PrismaBankAccountRepository();
const bankTransactionRepo = new PrismaBankTransactionRepository();
const bankReconciliationRepo = new PrismaBankReconciliationRepository();
const financialPeriodRepo = new PrismaFinancialPeriodRepository();
const withholdingConceptRepo = new PrismaWithholdingConceptRepository();
const costCenterRepo = new PrismaCostCenterRepository();
const companyReader = new PrismaCompanyReaderRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const thirdPartyResolver = new PrismaThirdPartyResolver();
const reports = new AccountingReportsService(journalRepo, accountRepo, cashSessionRepo, bankTransactionRepo, thirdPartyResolver);

const createAccountUseCase = new CreateAccountUseCase(accountRepo, auditService);
const updateAccountUseCase = new UpdateAccountUseCase(accountRepo, auditService);
const setAccountActiveUseCase = new SetAccountActiveUseCase(accountRepo, auditService);
const createEntryUseCase = new CreateJournalEntryUseCase(journalRepo, accountRepo, financialPeriodRepo, costCenterRepo, auditService);
const postEntryUseCase = new PostJournalEntryUseCase(journalRepo, auditService);

/** Usado tambien por suppliers.container.ts (CancelPurchaseUseCase) para anular el comprobante de
 * una compra cancelada -- operacion generica, no especifica de ningun modulo. */
export const voidJournalEntryUseCase = new VoidJournalEntryUseCase(journalRepo, auditService);

export const accountingController = new AccountingController(
  accountRepo,
  journalRepo,
  financialPeriodRepo,
  reports,
  createAccountUseCase,
  updateAccountUseCase,
  setAccountActiveUseCase,
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
  new ListBankReconciliationsUseCase(bankReconciliationRepo),
  new SuggestBankReconciliationMatchesUseCase(bankReconciliationRepo, bankTransactionRepo, journalRepo),
  new CloseFinancialPeriodUseCase(financialPeriodRepo, journalRepo, auditService),
  new ReopenFinancialPeriodUseCase(financialPeriodRepo, auditService),
  new CreateWithholdingConceptUseCase(withholdingConceptRepo, auditService),
  new UpdateWithholdingConceptUseCase(withholdingConceptRepo, auditService),
  new DeactivateWithholdingConceptUseCase(withholdingConceptRepo, auditService),
  new ListWithholdingConceptsUseCase(withholdingConceptRepo),
  new CreateCostCenterUseCase(costCenterRepo, auditService),
  new UpdateCostCenterUseCase(costCenterRepo, auditService),
  new DeactivateCostCenterUseCase(costCenterRepo, auditService),
  new ListCostCentersUseCase(costCenterRepo),
  companyReader
);

/** Usado por sale.container.ts y suppliers.container.ts para resolver los conceptos de retencion
 * aplicados a una venta/compra (validar que existan, esten activos y tomar su tarifa vigente). */
export const withholdingConceptRepository = withholdingConceptRepo;

/** Usado por expenses.container.ts para validar el centro de costo opcional de un gasto (item 34
 * de docs/ALCANCE.md). */
export const costCenterRepository = costCenterRepo;

/** Usado por payroll.container.ts para generar el comprobante de nomina al aprobar un periodo. */
export const postPayrollJournalEntryUseCase = new PostPayrollJournalEntryUseCase(
  accountRepo,
  createEntryUseCase,
  postEntryUseCase
);

/** Usado por sale.container.ts para contabilizar una venta al completarse. */
export const postSaleJournalEntryUseCase = new PostSaleJournalEntryUseCase(accountRepo, createEntryUseCase, postEntryUseCase);

/** Usado por return.container.ts para contabilizar una devolucion al registrarse. */
export const postReturnJournalEntryUseCase = new PostReturnJournalEntryUseCase(accountRepo, createEntryUseCase, postEntryUseCase);

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

/** Usado por expenses.container.ts para contabilizar un gasto operativo al registrarse. */
export const postExpenseJournalEntryUseCase = new PostExpenseJournalEntryUseCase(accountRepo, createEntryUseCase, postEntryUseCase);

/** Usado por collections.container.ts para contabilizar un cobro sobre una cuenta por cobrar. */
export const postReceivableCollectionJournalEntryUseCase = new PostReceivableCollectionJournalEntryUseCase(
  accountRepo,
  createEntryUseCase,
  postEntryUseCase
);

/** Usado por commissions.container.ts para contabilizar el pago de una liquidacion de comisiones. */
export const postCommissionJournalEntryUseCase = new PostCommissionJournalEntryUseCase(accountRepo, createEntryUseCase, postEntryUseCase);

/** Usado por fixed-assets.container.ts para contabilizar una entrada de depreciacion. */
export const postDepreciationJournalEntryUseCase = new PostDepreciationJournalEntryUseCase(accountRepo, createEntryUseCase, postEntryUseCase);
