import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { recurringInvoiceController } from "../recurring-invoice.container";

export const recurringInvoiceRouter = Router();
recurringInvoiceRouter.use(tenantContextMiddleware);

recurringInvoiceRouter.get(
  "/recurring-invoices",
  requirePermission("recurring-invoice.read"),
  recurringInvoiceController.list
);
recurringInvoiceRouter.post(
  "/recurring-invoices",
  requirePermission("recurring-invoice.manage"),
  recurringInvoiceController.create
);
recurringInvoiceRouter.patch(
  "/recurring-invoices/:id",
  requirePermission("recurring-invoice.manage"),
  recurringInvoiceController.update
);
recurringInvoiceRouter.post(
  "/recurring-invoices/:id/deactivate",
  requirePermission("recurring-invoice.manage"),
  recurringInvoiceController.deactivate
);
recurringInvoiceRouter.get(
  "/recurring-invoices/:id/runs",
  requirePermission("recurring-invoice.read"),
  recurringInvoiceController.listRuns
);
