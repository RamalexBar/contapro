import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { customerController } from "../customer.container";

export const customerRouter = Router();
customerRouter.use(tenantContextMiddleware);

customerRouter.get("/customers", requirePermission("customer.read"), customerController.list);
customerRouter.post("/customers", requirePermission("customer.manage"), customerController.create);
customerRouter.patch(
  "/customers/:id/price-list",
  requirePermission("customer.manage"),
  customerController.updatePriceList
);
