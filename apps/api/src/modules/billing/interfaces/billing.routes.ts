import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { billingController } from "../billing.container";

export const billingRouter = Router();
billingRouter.use(tenantContextMiddleware);

billingRouter.get("/subscription", requirePermission("billing.manage"), billingController.getOwnSubscription);
// Sin permiso: todos los usuarios ven el aviso de vencimiento / solo lectura
billingRouter.get("/subscription/access", billingController.getAccess);
billingRouter.post("/subscription/checkout", requirePermission("billing.manage"), billingController.createOwnCheckout);
billingRouter.post("/subscription/payment-source", requirePermission("billing.manage"), billingController.savePaymentSource);
billingRouter.post("/subscription/disable-auto-renew", requirePermission("billing.manage"), billingController.disableAutoRenew);
