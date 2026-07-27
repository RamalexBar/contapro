import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { GetDashboardMetricsUseCase } from "../application/use-cases/get-dashboard-metrics.use-case";
import { DashboardController } from "./dashboard.controller";

const dashboardController = new DashboardController(new GetDashboardMetricsUseCase());

export const dashboardRouter = Router();
dashboardRouter.use(tenantContextMiddleware);

dashboardRouter.get("/dashboard/metrics", requirePermission("dashboard.read"), dashboardController.metrics);
