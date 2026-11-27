import { PrismaPayrollCommissionReader } from "./infrastructure/prisma-payroll-commission.reader";
import { PrismaPayrollBonusRepository } from "./infrastructure/prisma-payroll-bonus.repository";
import { CancelPayrollBonusUseCase, CreatePayrollBonusUseCase, ListPayrollBonusesUseCase } from "./application/use-cases/payroll-bonus.use-cases";
import { PayrollBonusController } from "./interfaces/payroll-bonus.controller";
import { PrismaPayrollNoveltyReader } from "./infrastructure/prisma-payroll-novelty.reader";
import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postBenefitSettlementJournalEntryUseCase, postPayrollJournalEntryUseCase } from "../accounting/accounting.container";
import { generateElectronicPayrollUseCase, resubmitPayrollUseCase } from "../electronic-invoicing/electronic-invoicing.container";
import { IssueElectronicPayrollUseCase } from "./application/use-cases/issue-electronic-payroll.use-case";
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
import { UpdatePayrollSettingsUseCase } from "./application/use-cases/update-payroll-settings.use-case";
import { SendPayslipWhatsAppUseCase } from "./application/use-cases/send-payslip-whatsapp.use-case";
import { whatsAppSender, whatsAppDeliveryLogRepo } from "../whatsapp/whatsapp.container";
import { PayrollController } from "./interfaces/payroll.controller";
import { BenefitSettlementController } from "./interfaces/benefit-settlement.controller";
import { PrismaBenefitSettlementRepository } from "./infrastructure/prisma-benefit-settlement.repository";
import { SettleBenefitsUseCase } from "./application/use-cases/settle-benefits.use-case";

const payrollParameterRepo = new PrismaPayrollParameterRepository();
const payrollRepo = new PrismaPayrollRepository();
const payrollDeductionRepo = new PrismaPayrollDeductionRepository();
const payrollBonusRepo = new PrismaPayrollBonusRepository();
const payrollCommissionReader = new PrismaPayrollCommissionReader();
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

/** Parametros legales (tabla global): solo el panel de plataforma los crea o corrige. */
export const createPayrollParameterUseCase = new CreatePayrollParameterUseCase(payrollParameterRepo);
export const listPayrollParametersUseCase = new ListPayrollParametersUseCase(payrollParameterRepo);

const issueElectronicPayrollUseCase = new IssueElectronicPayrollUseCase(payrollRepo, generateElectronicPayrollUseCase, resubmitPayrollUseCase, auditService);

export const payrollController = new PayrollController(
  payrollRepo,
  employeeRepo,
  companyReader,
  listPayrollParametersUseCase,
  new CreatePayrollUseCase(payrollRepo, auditService),
  new ListPayrollsUseCase(payrollRepo),
  new CalculatePayrollUseCase(payrollRepo, employeeRepo, timeTrackingRepo, payrollParameterRepo, payrollDeductionRepo, companyReader, auditService, new PrismaPayrollNoveltyReader(), payrollBonusRepo, payrollCommissionReader),
  new ApprovePayrollUseCase(
    payrollRepo,
    payrollDeductionRepo,
    postPayrollJournalEntryUseCase,
    issueElectronicPayrollUseCase,
    sendPayslipWhatsAppUseCase,
    auditService,
    payrollCommissionReader
  ),
  new PayPayrollUseCase(payrollRepo, auditService),
  new CreatePayrollDeductionUseCase(payrollDeductionRepo, employeeRepo, auditService),
  new ListPayrollDeductionsUseCase(payrollDeductionRepo),
  new CancelPayrollDeductionUseCase(payrollDeductionRepo, auditService),
  whatsAppDeliveryLogRepo,
  sendPayslipWhatsAppUseCase,
  new UpdatePayrollSettingsUseCase(companyReader, auditService),
  issueElectronicPayrollUseCase
);

/** Prima de servicios, consolidacion de cesantias y liquidacion del contrato. */
const benefitSettlementRepo = new PrismaBenefitSettlementRepository();
export const benefitSettlementController = new BenefitSettlementController(
  new SettleBenefitsUseCase(benefitSettlementRepo, employeeRepo, payrollParameterRepo, postBenefitSettlementJournalEntryUseCase, auditService),
  benefitSettlementRepo,
  employeeRepo,
  companyReader
);

/** Bonificaciones no salariales (entran en la nomina del periodo de su fecha). */
export const payrollBonusController = new PayrollBonusController(
  new CreatePayrollBonusUseCase(payrollBonusRepo, employeeRepo, auditService),
  new ListPayrollBonusesUseCase(payrollBonusRepo),
  new CancelPayrollBonusUseCase(payrollBonusRepo, auditService)
);
