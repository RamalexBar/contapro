import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { profitabilityController } from "../profitability.container";

export const profitabilityRouter = Router();
profitabilityRouter.use(tenantContextMiddleware);

// accounting.read (reportes financieros): muestra costos y utilidades, que el rol Cajero no debe ver.
profitabilityRouter.get("/reports/profitability", requirePermission("accounting.read"), profitabilityController.get);
