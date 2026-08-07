import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { rbacController } from "../rbac.container";

export const rbacRouter = Router();
rbacRouter.use(tenantContextMiddleware);

rbacRouter.get("/roles", requirePermission("rbac.manage"), rbacController.listRoles);
rbacRouter.post("/roles", requirePermission("rbac.manage"), rbacController.createRole);
rbacRouter.put("/roles/:roleId/permissions", requirePermission("rbac.manage"), rbacController.assignPermissions);
rbacRouter.get("/permissions", requirePermission("rbac.manage"), rbacController.listPermissions);
rbacRouter.put("/users/:userId/permissions", requirePermission("rbac.manage"), rbacController.grantUserPermission);
rbacRouter.get("/users/:userId/effective-permissions", requirePermission("rbac.manage"), rbacController.effectivePermissions);
rbacRouter.get("/users", requirePermission("rbac.manage"), rbacController.listUsers);
rbacRouter.post("/users", requirePermission("rbac.manage"), rbacController.createUser);
rbacRouter.post("/users/:userId/roles", requirePermission("rbac.manage"), rbacController.assignRole);
rbacRouter.delete("/users/:userId/roles/:roleId", requirePermission("rbac.manage"), rbacController.removeRole);
