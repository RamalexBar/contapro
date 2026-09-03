import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { manualInvoicingController } from "../manual-invoicing.container";

export const manualInvoicingRouter = Router();
manualInvoicingRouter.use(tenantContextMiddleware);

// Permisos reusados de pos/sale (conceptualmente "crear/ver un documento tipo venta", ver
// CLAUDE.md sobre reusar permisos existentes en vez de crear uno nuevo por feature).
manualInvoicingRouter.post("/manual-invoices", requirePermission("sale.create"), manualInvoicingController.create);
manualInvoicingRouter.get("/manual-invoices", requirePermission("sale.read"), manualInvoicingController.list);
manualInvoicingRouter.get("/manual-invoices/:id", requirePermission("sale.read"), manualInvoicingController.get);
