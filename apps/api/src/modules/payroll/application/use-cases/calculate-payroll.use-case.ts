import { assertLegalSalaries } from "../salary-floor";
import { legalMonthlyHoursDivisor } from "../payroll-calculator";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ITimeTrackingRepository } from "../../../timetracking/domain/timetracking.repository";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { IPayrollDeductionRepository } from "../../domain/payroll-deduction.repository";
import type { IPayrollParameterRepository } from "../../domain/payroll-parameter.repository";
import type { IPayrollNoveltyReader } from "../../domain/payroll-novelty.reader";
import type { EmployeeCalculationResult, IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";
import { calculateEmployeePayroll } from "../payroll-calculator";

const RECALCULABLE_STATUSES = new Set(["DRAFT", "CALCULATED"]);

export class CalculatePayrollUseCase {
  constructor(
    private readonly payrollRepo: IPayrollRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly timeTrackingRepo: ITimeTrackingRepository,
    private readonly parameterRepo: IPayrollParameterRepository,
    private readonly deductionRepo: IPayrollDeductionRepository,
    private readonly companyReader: ICompanyReader,
    private readonly audit: AuditService,
    private readonly noveltyReader: IPayrollNoveltyReader
  ) {}

  async execute(payrollId: string): Promise<PayrollRecord> {
    const payroll = await this.payrollRepo.findByIdOrThrow(payrollId);
    if (!RECALCULABLE_STATUSES.has(payroll.status)) {
      throw new ValidationError(
        `Solo se puede calcular una nomina en estado DRAFT o CALCULADA (actual: ${payroll.status})`
      );
    }

    const parameter = await this.parameterRepo.findByYearOrThrow(payroll.year);
    const company = await this.companyReader.findByIdOrThrow(payroll.companyId);
    const companyOptions = { exemptArt1141: company.payrollExemptArt1141 };
    const employees = await this.employeeRepo.listActiveForPeriod(payroll.branchId, payroll.startDate, payroll.endDate);

    // Pisos legales: salario minimo (ordinario) y 13 SMMLV (integral).
    assertLegalSalaries(employees, parameter.minimumWage, legalMonthlyHoursDivisor(payroll.endDate, parameter.monthlyHoursDivisor) / 5);

    const results: EmployeeCalculationResult[] = [];
    for (const employee of employees) {
      const timeEntries = await this.timeTrackingRepo.listClosedForPeriod(employee.id, payroll.startDate, payroll.endDate);
      const activeDeductions = await this.deductionRepo.listActiveForEmployee(employee.id);
      const novelties = await this.noveltyReader.listForPeriod(employee.id, payroll.startDate, payroll.endDate);
      results.push(
        calculateEmployeePayroll(employee, parameter, timeEntries, payroll.startDate, payroll.endDate, activeDeductions, companyOptions, novelties)
      );
    }

    await this.payrollRepo.saveCalculationResults(payroll.id, results);
    const updated = await this.payrollRepo.updateStatus(payroll.id, "CALCULATED", { calculatedAt: new Date() });

    await this.audit.record({
      action: "PAYROLL_CALCULATED",
      entityType: "Payroll",
      entityId: updated.id,
      description: `Nomina calculada: ${updated.month}/${updated.year} (${results.length} empleados)`,
      metadata: { employeeCount: results.length, exemptArt1141: company.payrollExemptArt1141 },
    });

    return updated;
  }
}
