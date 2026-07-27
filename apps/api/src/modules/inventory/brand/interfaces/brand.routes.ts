import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { brandController } from "../brand.container";

export const brandRouter = Router();
brandRouter.use(tenantContextMiddleware);

brandRouter.get("/brands", requirePermission("product.read"), brandController.list);
brandRouter.post("/brands", requirePermission("brand.manage"), brandController.create);
