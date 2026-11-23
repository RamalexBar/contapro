import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { payrollController } from "../payroll.container";

export const payrollRouter = Router();
payrollRouter.use(tenantContextMiddleware);

// Solo lectura para las empresas: los parametros legales son globales y los publica el panel de
// plataforma (payroll-platform.routes.ts).
payrollRouter.get("/payroll-parameters", requirePermission("payroll.read"), payrollController.listParameters);

// Configuracion de nomina de la empresa (exoneracion art. 114-1 E.T.): la cambia quien maneja los
// parametros legales (administrador o contador).
payrollRouter.get("/payroll-settings", requirePermission("payroll.read"), payrollController.getSettings);
payrollRouter.put("/payroll-settings", requirePermission("payroll.parameter.manage"), payrollController.updateSettings);

payrollRouter.post("/payrolls", requirePermission("payroll.create"), payrollController.create);
payrollRouter.get("/payrolls", requirePermission("payroll.read"), payrollController.list);
payrollRouter.get("/payrolls/:id", requirePermission("payroll.read"), payrollController.getById);
payrollRouter.post("/payrolls/:id/calculate", requirePermission("payroll.calculate"), payrollController.calculate);
payrollRouter.post("/payrolls/:id/approve", requirePermission("payroll.approve"), payrollController.approve);
payrollRouter.post("/payrolls/:id/pay", requirePermission("payroll.pay"), payrollController.pay);

payrollRouter.get("/payslips/:id", requirePermission("payroll.read"), payrollController.getPayslip);
payrollRouter.get("/payslips/:id/pdf", requirePermission("payroll.read"), payrollController.getPayslipPdf);
payrollRouter.get(
  "/payslips/:id/whatsapp-deliveries",
  requirePermission("payroll.read"),
  payrollController.listPayslipWhatsAppDeliveries
);
payrollRouter.post(
  "/payslips/:id/whatsapp/resend",
  requirePermission("payroll.approve"),
  payrollController.resendPayslipWhatsApp
);

payrollRouter.post("/payroll-deductions", requirePermission("payroll.deduction.manage"), payrollController.createDeduction);
payrollRouter.get("/payroll-deductions", requirePermission("payroll.read"), payrollController.listDeductions);
payrollRouter.post(
  "/payroll-deductions/:id/cancel",
  requirePermission("payroll.deduction.manage"),
  payrollController.cancelDeduction
);
