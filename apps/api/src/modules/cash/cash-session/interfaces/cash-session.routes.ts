import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { cashSessionController } from "../cash-session.container";

export const cashSessionRouter = Router();
cashSessionRouter.use(tenantContextMiddleware);

cashSessionRouter.get("/cash/registers", requirePermission("cash.session.open"), cashSessionController.listRegisters);
cashSessionRouter.post("/cash/sessions/open", requirePermission("cash.session.open"), cashSessionController.open);
cashSessionRouter.post("/cash/sessions/:id/close", requirePermission("cash.session.close"), cashSessionController.close);
cashSessionRouter.get("/cash/registers/:cashRegisterId/active-session", requirePermission("cash.session.open"), cashSessionController.getActive);
cashSessionRouter.post("/cash/sessions/:id/movements", requirePermission("cash.movement.create"), cashSessionController.registerMovement);
