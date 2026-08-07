import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { apiKeyController } from "../public-api.container";

export const apiKeyRouter = Router();
apiKeyRouter.use(tenantContextMiddleware);

apiKeyRouter.get("/api-keys", requirePermission("api-key.read"), apiKeyController.list);
apiKeyRouter.post("/api-keys", requirePermission("api-key.manage"), apiKeyController.create);
apiKeyRouter.post("/api-keys/:id/deactivate", requirePermission("api-key.manage"), apiKeyController.deactivate);
