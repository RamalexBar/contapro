import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { accountingController } from "../accounting.container";

export const accountingRouter = Router();
accountingRouter.use(tenantContextMiddleware);

accountingRouter.get(
  "/chart-of-accounts",
  requirePermission("accounting.read"),
  accountingController.listAccounts
);
accountingRouter.post(
  "/chart-of-accounts",
  requirePermission("accounting.manage"),
  accountingController.createAccount
);

accountingRouter.get("/journal-entries", requirePermission("accounting.read"), accountingController.listEntries);
accountingRouter.get("/journal-entries/:id", requirePermission("accounting.read"), accountingController.getEntry);
accountingRouter.post(
  "/journal-entries",
  requirePermission("accounting.manage"),
  accountingController.createEntry
);
accountingRouter.post(
  "/journal-entries/:id/post",
  requirePermission("accounting.manage"),
  accountingController.postEntry
);
accountingRouter.post(
  "/journal-entries/:id/void",
  requirePermission("accounting.manage"),
  accountingController.voidEntry
);

accountingRouter.get(
  "/reports/balance-sheet",
  requirePermission("accounting.read"),
  accountingController.getBalanceSheet
);
accountingRouter.get(
  "/reports/income-statement",
  requirePermission("accounting.read"),
  accountingController.getIncomeStatement
);
accountingRouter.get(
  "/reports/ledger/:accountId",
  requirePermission("accounting.read"),
  accountingController.getLedger
);
accountingRouter.get(
  "/reports/cash-flow",
  requirePermission("accounting.read"),
  accountingController.getCashFlow
);

accountingRouter.post("/bank-accounts", requirePermission("accounting.manage"), accountingController.createBankAccount);
accountingRouter.get("/bank-accounts", requirePermission("accounting.read"), accountingController.listBankAccounts);
accountingRouter.post(
  "/bank-accounts/:id/transactions",
  requirePermission("accounting.manage"),
  accountingController.registerBankTransaction
);
accountingRouter.get(
  "/bank-accounts/:id/transactions",
  requirePermission("accounting.read"),
  accountingController.listBankTransactions
);

accountingRouter.post(
  "/bank-reconciliations",
  requirePermission("accounting.manage"),
  accountingController.startBankReconciliation
);
accountingRouter.get(
  "/bank-reconciliations",
  requirePermission("accounting.read"),
  accountingController.listBankReconciliations
);
accountingRouter.get(
  "/bank-reconciliations/:id",
  requirePermission("accounting.read"),
  accountingController.getBankReconciliation
);
accountingRouter.get(
  "/bank-reconciliations/:id/suggested-matches",
  requirePermission("accounting.read"),
  accountingController.suggestBankReconciliationMatches
);
accountingRouter.post(
  "/bank-reconciliations/:id/match",
  requirePermission("accounting.manage"),
  accountingController.matchBankReconciliationItem
);
accountingRouter.post(
  "/bank-reconciliations/:id/close",
  requirePermission("accounting.manage"),
  accountingController.closeBankReconciliation
);

accountingRouter.get(
  "/financial-periods",
  requirePermission("accounting.read"),
  accountingController.listFinancialPeriods
);
accountingRouter.post(
  "/financial-periods/:year/:month/close",
  requirePermission("accounting.manage"),
  accountingController.closeFinancialPeriod
);
accountingRouter.post(
  "/financial-periods/:year/:month/reopen",
  requirePermission("accounting.manage"),
  accountingController.reopenFinancialPeriod
);
