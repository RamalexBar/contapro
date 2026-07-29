import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postPayrollJournalEntryUseCase } from "../accounting/accounting.container";
import { employeeRepo } from "../employees/employees.container";
import { timeTrackingRepo } from "../timetracking/timetracking.container";
import { PrismaPayrollParameterRepository } from "./infrastructure/prisma-payroll-parameter.repository";
import { PrismaPayrollRepository } from "./infrastructure/prisma-payroll.repository";
import { CreatePayrollParameterUseCase } from "./application/use-cases/create-payroll-parameter.use-case";
import { ListPayrollParametersUseCase } from "./application/use-cases/list-payroll-parameters.use-case";
import { CreatePayrollUseCase } from "./application/use-cases/create-payroll.use-case";
import { ListPayrollsUseCase } from "./application/use-cases/list-payrolls.use-case";
import { CalculatePayrollUseCase } from "./application/use-cases/calculate-payroll.use-case";
import { ApprovePayrollUseCase } from "./application/use-cases/approve-payroll.use-case";
import { PayPayrollUseCase } from "./application/use-cases/pay-payroll.use-case";
import { PayrollController } from "./interfaces/payroll.controller";

const payrollParameterRepo = new PrismaPayrollParameterRepository();
const payrollRepo = new PrismaPayrollRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const payrollController = new PayrollController(
  payrollRepo,
  new CreatePayrollParameterUseCase(payrollParameterRepo, auditService),
  new ListPayrollParametersUseCase(payrollParameterRepo),
  new CreatePayrollUseCase(payrollRepo, auditService),
  new ListPayrollsUseCase(payrollRepo),
  new CalculatePayrollUseCase(payrollRepo, employeeRepo, timeTrackingRepo, payrollParameterRepo, auditService),
  new ApprovePayrollUseCase(payrollRepo, postPayrollJournalEntryUseCase, auditService),
  new PayPayrollUseCase(payrollRepo, auditService)
);
