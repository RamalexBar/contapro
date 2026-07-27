import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";

export const accountingRouter = Router();
accountingRouter.use(tenantContextMiddleware);

const stub = notImplemented("accounting");
accountingRouter.all("/chart-of-accounts", stub);
accountingRouter.all("/journal-entries", stub);
accountingRouter.all("/reports/balance-sheet", stub);
accountingRouter.all("/reports/income-statement", stub);
accountingRouter.all("/reports/cash-flow", stub);
accountingRouter.all("/bank-reconciliations", stub);
