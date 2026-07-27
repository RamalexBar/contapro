import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { categoryController } from "../category.container";

export const categoryRouter = Router();
categoryRouter.use(tenantContextMiddleware);

categoryRouter.get("/categories", requirePermission("product.read"), categoryController.list);
categoryRouter.post("/categories", requirePermission("category.manage"), categoryController.create);
