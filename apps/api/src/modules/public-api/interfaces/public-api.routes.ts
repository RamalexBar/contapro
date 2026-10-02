import { Router } from "express";
import { apiKeyAuthMiddleware } from "../../../shared/middlewares/api-key-auth.middleware";
import { publicApiRateLimiter } from "../../../shared/middlewares/public-api-rate-limit.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { publicApiController } from "../public-api.container";
// Reusado tal cual (mismo handler que ya sirve el PDF de una factura manual via JWT) -- cero
// logica nueva, solo se monta bajo auth por API key en vez de JWT. Ver README: "Factura en si".
import { electronicInvoicingController } from "../../electronic-invoicing/electronic-invoicing.container";

export const publicApiRouter = Router();
publicApiRouter.use("/public/v1", publicApiRateLimiter, apiKeyAuthMiddleware);

publicApiRouter.get("/public/v1/products", requirePermission("product.read"), publicApiController.listProducts);
publicApiRouter.get("/public/v1/products/:id", requirePermission("product.read"), publicApiController.getProduct);
publicApiRouter.get("/public/v1/customers", requirePermission("customer.read"), publicApiController.listCustomers);
publicApiRouter.post("/public/v1/customers", requirePermission("customer.manage"), publicApiController.createCustomer);
publicApiRouter.get("/public/v1/sales", requirePermission("sale.read"), publicApiController.listSales);
publicApiRouter.post("/public/v1/sales", requirePermission("sale.create"), publicApiController.createSale);

publicApiRouter.get("/public/v1/shift-closes", requirePermission("accounting.read"), publicApiController.listShiftCloses);
publicApiRouter.post("/public/v1/shift-closes", requirePermission("accounting.manage"), publicApiController.registerShiftClose);

publicApiRouter.post("/public/v1/electronic-invoices", requirePermission("sale.create"), publicApiController.registerElectronicInvoice);
publicApiRouter.get("/public/v1/electronic-invoices/:id", requirePermission("sale.read"), publicApiController.getElectronicInvoice);
publicApiRouter.get(
  "/public/v1/electronic-invoices/:manualInvoiceId/pdf",
  requirePermission("sale.read"),
  electronicInvoicingController.getPdfByManualInvoice
);

publicApiRouter.post("/public/v1/purchases", requirePermission("suppliers.manage"), publicApiController.registerPurchase);
publicApiRouter.post("/public/v1/purchases/:id/cancel", requirePermission("suppliers.manage"), publicApiController.cancelPurchase);
publicApiRouter.post("/public/v1/supplier-payments", requirePermission("suppliers.manage"), publicApiController.registerSupplierPayment);
publicApiRouter.post("/public/v1/expenses", requirePermission("expense.manage"), publicApiController.registerExpense);
