import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postPayrollJournalEntryUseCase } from "../accounting/accounting.container";
import { generateElectronicPayrollUseCase } from "../electronic-invoicing/electronic-invoicing.container";
import { employeeRepo } from "../employees/employees.container";
import { timeTrackingRepo } from "../timetracking/timetracking.container";
import { PrismaPayrollParameterRepository } from "./infrastructure/prisma-payroll-parameter.repository";
import { PrismaPayrollRepository } from "./infrastructure/prisma-payroll.repository";
import { PrismaPayrollDeductionRepository } from "./infrastructure/prisma-payroll-deduction.repository";
import { PrismaCompanyReaderRepository } from "./infrastructure/prisma-company-reader.repository";
import { CreatePayrollParameterUseCase } from "./application/use-cases/create-payroll-parameter.use-case";
import { ListPayrollParametersUseCase } from "./application/use-cases/list-payroll-parameters.use-case";
import { CreatePayrollUseCase } from "./application/use-cases/create-payroll.use-case";
import { ListPayrollsUseCase } from "./application/use-cases/list-payrolls.use-case";
import { CalculatePayrollUseCase } from "./application/use-cases/calculate-payroll.use-case";
import { ApprovePayrollUseCase } from "./application/use-cases/approve-payroll.use-case";
import { PayPayrollUseCase } from "./application/use-cases/pay-payroll.use-case";
import { CreatePayrollDeductionUseCase } from "./application/use-cases/create-payroll-deduction.use-case";
import { ListPayrollDeductionsUseCase } from "./application/use-cases/list-payroll-deductions.use-case";
import { CancelPayrollDeductionUseCase } from "./application/use-cases/cancel-payroll-deduction.use-case";
import { SendPayslipWhatsAppUseCase } from "./application/use-cases/send-payslip-whatsapp.use-case";
import { whatsAppSender, whatsAppDeliveryLogRepo } from "../whatsapp/whatsapp.container";
import { PayrollController } from "./interfaces/payroll.controller";

const payrollParameterRepo = new PrismaPayrollParameterRepository();
const payrollRepo = new PrismaPayrollRepository();
const payrollDeductionRepo = new PrismaPayrollDeductionRepository();
const companyReader = new PrismaCompanyReaderRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

/** Usado por ApprovePayrollUseCase (al aprobar el periodo) y por el endpoint de reenvio manual
 * de este mismo modulo. */
export const sendPayslipWhatsAppUseCase = new SendPayslipWhatsAppUseCase(
  employeeRepo,
  payrollRepo,
  companyReader,
  whatsAppSender,
  whatsAppDeliveryLogRepo,
  auditService
);

export const payrollController = new PayrollController(
  payrollRepo,
  employeeRepo,
  companyReader,
  new CreatePayrollParameterUseCase(payrollParameterRepo, auditService),
  new ListPayrollParametersUseCase(payrollParameterRepo),
  new CreatePayrollUseCase(payrollRepo, auditService),
  new ListPayrollsUseCase(payrollRepo),
  new CalculatePayrollUseCase(payrollRepo, employeeRepo, timeTrackingRepo, payrollParameterRepo, payrollDeductionRepo, auditService),
  new ApprovePayrollUseCase(
    payrollRepo,
    payrollDeductionRepo,
    postPayrollJournalEntryUseCase,
    generateElectronicPayrollUseCase,
    sendPayslipWhatsAppUseCase,
    auditService
  ),
  new PayPayrollUseCase(payrollRepo, auditService),
  new CreatePayrollDeductionUseCase(payrollDeductionRepo, employeeRepo, auditService),
  new ListPayrollDeductionsUseCase(payrollDeductionRepo),
  new CancelPayrollDeductionUseCase(payrollDeductionRepo, auditService),
  whatsAppDeliveryLogRepo,
  sendPayslipWhatsAppUseCase
);
