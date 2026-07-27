import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";

export const employeesRouter = Router();
employeesRouter.use(tenantContextMiddleware);

employeesRouter.all("/employees", notImplemented("employees"));
