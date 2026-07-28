import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { payrollController } from "../payroll.container";

export const payrollRouter = Router();
payrollRouter.use(tenantContextMiddleware);

payrollRouter.post("/payroll-parameters", requirePermission("payroll.parameter.manage"), payrollController.createParameter);
payrollRouter.get("/payroll-parameters", requirePermission("payroll.parameter.manage"), payrollController.listParameters);

payrollRouter.post("/payrolls", requirePermission("payroll.create"), payrollController.create);
payrollRouter.get("/payrolls", requirePermission("payroll.read"), payrollController.list);
payrollRouter.get("/payrolls/:id", requirePermission("payroll.read"), payrollController.getById);
payrollRouter.post("/payrolls/:id/calculate", requirePermission("payroll.calculate"), payrollController.calculate);
payrollRouter.post("/payrolls/:id/approve", requirePermission("payroll.approve"), payrollController.approve);
payrollRouter.post("/payrolls/:id/pay", requirePermission("payroll.pay"), payrollController.pay);

payrollRouter.get("/payslips/:id", requirePermission("payroll.read"), payrollController.getPayslip);
