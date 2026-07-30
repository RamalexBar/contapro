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
electronicInvoicingRouter.post(
  "/electronic-invoicing/sales/:saleId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmit
);

electronicInvoicingRouter.get(
  "/electronic-invoicing/credit-notes/:creditNoteId",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getByCreditNote
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/credit-notes/:creditNoteId/xml",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getXmlByCreditNote
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/credit-notes/:creditNoteId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmitCreditNote
);

electronicInvoicingRouter.get(
  "/electronic-invoicing/debit-notes/:debitNoteId",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getByDebitNote
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/debit-notes/:debitNoteId/xml",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getXmlByDebitNote
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/debit-notes/:debitNoteId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmitDebitNote
);

electronicInvoicingRouter.get(
  "/electronic-invoicing/purchases/:purchaseId",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getBySupportDocument
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/purchases/:purchaseId/xml",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getXmlBySupportDocument
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/purchases/:purchaseId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmitSupportDocument
);

electronicInvoicingRouter.get(
  "/electronic-invoicing/payroll-details/:payrollDetailId",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getByPayrollDetail
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/payroll-details/:payrollDetailId/xml",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getXmlByPayrollDetail
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/payroll-details/:payrollDetailId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmitPayrollDetail
);
