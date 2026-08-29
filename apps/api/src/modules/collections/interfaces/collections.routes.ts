import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { collectionsController } from "../collections.container";

export const collectionsRouter = Router();
collectionsRouter.use(tenantContextMiddleware);

collectionsRouter.get(
  "/accounts-receivable",
  requirePermission("collection.read"),
  collectionsController.listAccountsReceivable
);
collectionsRouter.post(
  "/accounts-receivable/:id/payments",
  requirePermission("collection.manage"),
  collectionsController.registerPayment
);
collectionsRouter.post(
  "/accounts-receivable/:id/checkout",
  requirePermission("collection.manage"),
  collectionsController.createCheckout
);
collectionsRouter.get(
  "/receivable-payments/:id/pdf",
  requirePermission("collection.read"),
  collectionsController.getPaymentPdf
);
