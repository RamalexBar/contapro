import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { returnController } from "../return.container";

export const returnRouter = Router();
returnRouter.use(tenantContextMiddleware);

returnRouter.get("/returns", requirePermission("sale.read"), returnController.list);
returnRouter.post("/returns", requirePermission("return.create"), returnController.create);
