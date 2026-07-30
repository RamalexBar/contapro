import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { electronicInvoicingController } from "../electronic-invoicing.container";

export const electronicInvoicingRouter = Router();
electronicInvoicingRouter.use(tenantContextMiddleware);

electronicInvoicingRouter.post(
  "/electronic-invoicing/numbering-resolutions",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.createResolution
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/numbering-resolutions",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.listResolutions
);

electronicInvoicingRouter.get(
  "/electronic-invoicing/sales/:saleId",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getBySale
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/sales/:saleId/xml",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getXmlBySale
);
