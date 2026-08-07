import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { commissionsController } from "../commissions.container";

export const commissionsRouter = Router();
commissionsRouter.use(tenantContextMiddleware);

commissionsRouter.get("/commission-schemes", requirePermission("commission.read"), commissionsController.listSchemes);
commissionsRouter.post("/commission-schemes", requirePermission("commission.manage"), commissionsController.createScheme);
commissionsRouter.patch("/commission-schemes/:id", requirePermission("commission.manage"), commissionsController.updateScheme);
commissionsRouter.post(
  "/commission-schemes/:id/deactivate",
  requirePermission("commission.manage"),
  commissionsController.deactivateScheme
);

commissionsRouter.get("/commissions/sellers", requirePermission("commission.read"), commissionsController.listSellers);
commissionsRouter.post("/commissions/calculate", requirePermission("commission.manage"), commissionsController.calculate);
commissionsRouter.get("/commissions/settlements", requirePermission("commission.read"), commissionsController.listSettlements);
commissionsRouter.post(
  "/commissions/settlements/:id/pay",
  requirePermission("commission.manage"),
  commissionsController.pay
);
