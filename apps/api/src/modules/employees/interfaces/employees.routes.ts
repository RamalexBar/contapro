import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { employeeController } from "../employees.container";

export const employeesRouter = Router();
employeesRouter.use(tenantContextMiddleware);

employeesRouter.get("/employees", requirePermission("employee.read"), employeeController.list);
employeesRouter.get("/employees/me", employeeController.me);
employeesRouter.get("/employees/:id", requirePermission("employee.read"), employeeController.getById);
employeesRouter.post("/employees", requirePermission("employee.create"), employeeController.create);
employeesRouter.patch("/employees/:id", requirePermission("employee.update"), employeeController.update);
employeesRouter.post("/employees/:id/deactivate", requirePermission("employee.deactivate"), employeeController.deactivate);
