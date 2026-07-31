import { Router } from "express";
import { requirePlatformAdmin } from "../../../shared/middlewares/require-platform-admin.middleware";
import { saasAdminController } from "../saas-admin.container";

// NOTA: este router NO usa tenantContextMiddleware -- el panel de administrador SaaS es
// transversal a todas las empresas, protegido por requirePlatformAdmin (JWT con secreto propio,
// ver shared/middlewares/require-platform-admin.middleware.ts y config/env.ts).
export const saasAdminRouter = Router();

saasAdminRouter.post("/admin/auth/login", saasAdminController.login);

saasAdminRouter.post("/admin/plans", requirePlatformAdmin, saasAdminController.createPlan);
saasAdminRouter.get("/admin/plans", requirePlatformAdmin, saasAdminController.listPlans);
saasAdminRouter.patch("/admin/plans/:id", requirePlatformAdmin, saasAdminController.updatePlan);

saasAdminRouter.post("/admin/subscriptions", requirePlatformAdmin, saasAdminController.createSubscription);
saasAdminRouter.get("/admin/subscriptions", requirePlatformAdmin, saasAdminController.listSubscriptions);
saasAdminRouter.get("/admin/subscriptions/:id", requirePlatformAdmin, saasAdminController.getSubscription);
saasAdminRouter.post(
  "/admin/subscriptions/:id/payments",
  requirePlatformAdmin,
  saasAdminController.registerSubscriptionPayment
);

saasAdminRouter.get("/admin/companies", requirePlatformAdmin, saasAdminController.listCompanies);
saasAdminRouter.get("/admin/dashboard", requirePlatformAdmin, saasAdminController.getDashboard);
