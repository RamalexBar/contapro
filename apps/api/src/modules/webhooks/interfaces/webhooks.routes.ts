import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { webhooksController } from "../webhooks.container";

export const webhooksRouter = Router();
webhooksRouter.use(tenantContextMiddleware);

webhooksRouter.get("/webhook-subscriptions", requirePermission("webhook.read"), webhooksController.list);
webhooksRouter.post("/webhook-subscriptions", requirePermission("webhook.manage"), webhooksController.create);
webhooksRouter.post(
  "/webhook-subscriptions/:id/deactivate",
  requirePermission("webhook.manage"),
  webhooksController.deactivate
);
webhooksRouter.get(
  "/webhook-subscriptions/:id/deliveries",
  requirePermission("webhook.read"),
  webhooksController.listDeliveries
);
webhooksRouter.post(
  "/webhook-deliveries/:id/resend",
  requirePermission("webhook.manage"),
  webhooksController.resendDelivery
);
