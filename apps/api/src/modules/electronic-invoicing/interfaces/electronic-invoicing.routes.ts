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
  "/electronic-invoicing/provider-settings",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getProviderSettings
);
electronicInvoicingRouter.put(
  "/electronic-invoicing/provider-settings",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.setProviderSettings
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
electronicInvoicingRouter.get(
  "/electronic-invoicing/sales/:saleId/pdf",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getPdfBySale
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/sales/:saleId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmit
);

// ---- Factura manual (modules/manual-invoicing, sin POS/producto) ----
electronicInvoicingRouter.get(
  "/electronic-invoicing/manual-invoices/:manualInvoiceId",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getByManualInvoice
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/manual-invoices/:manualInvoiceId/xml",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getXmlByManualInvoice
);
electronicInvoicingRouter.get(
  "/electronic-invoicing/manual-invoices/:manualInvoiceId/pdf",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getPdfByManualInvoice
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/manual-invoices/:manualInvoiceId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmitManualInvoice
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
electronicInvoicingRouter.get(
  "/electronic-invoicing/credit-notes/:creditNoteId/pdf",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getPdfByCreditNote
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
electronicInvoicingRouter.get(
  "/electronic-invoicing/debit-notes/:debitNoteId/pdf",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getPdfByDebitNote
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
electronicInvoicingRouter.get(
  "/electronic-invoicing/purchases/:purchaseId/pdf",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getPdfBySupportDocument
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
electronicInvoicingRouter.get(
  "/electronic-invoicing/payroll-details/:payrollDetailId/pdf",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.getPdfByPayrollDetail
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/payroll-details/:payrollDetailId/resubmit",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resubmitPayrollDetail
);

// ---- Envio del RIDE por WhatsApp (item 41 de docs/ALCANCE.md) ----
electronicInvoicingRouter.get(
  "/electronic-invoicing/sales/:saleId/whatsapp-deliveries",
  requirePermission("electronic-invoicing.read"),
  electronicInvoicingController.listSaleWhatsAppDeliveries
);
electronicInvoicingRouter.post(
  "/electronic-invoicing/sales/:saleId/whatsapp/resend",
  requirePermission("electronic-invoicing.manage"),
  electronicInvoicingController.resendSaleWhatsApp
);
