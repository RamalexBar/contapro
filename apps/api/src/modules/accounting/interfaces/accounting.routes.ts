import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";
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

// Flujo de caja y conciliacion bancaria: aun no implementado, ver README.md del modulo.
const stub = notImplemented("accounting");
accountingRouter.all("/reports/cash-flow", stub);
accountingRouter.all("/bank-reconciliations", stub);
