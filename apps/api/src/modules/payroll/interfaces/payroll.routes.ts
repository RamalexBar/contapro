import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";

export const payrollRouter = Router();
payrollRouter.use(tenantContextMiddleware);

const stub = notImplemented("payroll");
payrollRouter.all("/payrolls", stub);
payrollRouter.all("/payroll-parameters", stub);
payrollRouter.all("/payslips/:id", stub);
