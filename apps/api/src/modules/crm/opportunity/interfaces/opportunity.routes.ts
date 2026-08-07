import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { opportunityController } from "../opportunity.container";

export const opportunityRouter = Router();
opportunityRouter.use(tenantContextMiddleware);

opportunityRouter.get("/opportunities", requirePermission("opportunity.read"), opportunityController.list);
opportunityRouter.post("/opportunities", requirePermission("opportunity.manage"), opportunityController.create);
opportunityRouter.patch("/opportunities/:id/stage", requirePermission("opportunity.manage"), opportunityController.updateStage);
opportunityRouter.post("/opportunities/:id/win", requirePermission("opportunity.manage"), opportunityController.closeAsWon);
