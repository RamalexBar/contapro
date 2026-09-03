import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { companyController } from "../company.container";

export const companyRouter = Router();
companyRouter.use(tenantContextMiddleware);

// Permisos reusados de electronic-invoicing (mismo precedente que
// GET/PUT /electronic-invoicing/provider-settings, que ya lee/escribe columnas de Company en ese
// mismo controller) -- no vale la pena un permiso company.* nuevo solo para esto.
companyRouter.get("/company/profile", requirePermission("electronic-invoicing.read"), companyController.getProfile);
companyRouter.put("/company/profile", requirePermission("electronic-invoicing.manage"), companyController.updateProfile);
