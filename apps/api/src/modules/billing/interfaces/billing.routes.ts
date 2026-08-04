import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { billingController } from "../billing.container";

export const billingRouter = Router();
billingRouter.use(tenantContextMiddleware);

billingRouter.get("/subscription", requirePermission("billing.manage"), billingController.getOwnSubscription);
billingRouter.post("/subscription/checkout", requirePermission("billing.manage"), billingController.createOwnCheckout);
