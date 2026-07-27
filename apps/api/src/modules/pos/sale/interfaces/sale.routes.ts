import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { saleController } from "../sale.container";

export const saleRouter = Router();
saleRouter.use(tenantContextMiddleware);

saleRouter.get("/sales", requirePermission("sale.read"), saleController.list);
saleRouter.get("/sales/:id", requirePermission("sale.read"), saleController.getById);
saleRouter.post("/sales", requirePermission("sale.create"), saleController.create);
saleRouter.post("/sales/:id/authorize-discount", requirePermission("discount.authorize"), saleController.authorizeDiscount);
saleRouter.post("/sales/:id/cancel", requirePermission("sale.cancel"), saleController.cancel);
