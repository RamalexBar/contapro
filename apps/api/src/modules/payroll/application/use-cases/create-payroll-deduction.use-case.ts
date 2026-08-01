import type { CreatePayrollDeductionInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { IPayrollDeductionRepository, PayrollDeductionRecord } from "../../domain/payroll-deduction.repository";

export class CreatePayrollDeductionUseCase {
  constructor(
    private readonly repo: IPayrollDeductionRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreatePayrollDeductionInput): Promise<PayrollDeductionRecord> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);

    if (input.totalAmount !== undefined && input.amountPerPeriod > input.totalAmount) {
      throw new ValidationError("La cuota por periodo no puede ser mayor que el monto total");
    }

    const ctx = getTenantContext();
    const deduction = await this.repo.create({ ...input, createdByUserId: ctx.userId });

    await this.audit.record({
      action: "PAYROLL_DEDUCTION_CREATED",
      entityType: "PayrollDeduction",
      entityId: deduction.id,
      description: `${deduction.type === "LOAN_DEDUCTION" ? "Libranza" : "Embargo"} registrado para ${employee.firstName} ${employee.lastName}: ${deduction.description} (${deduction.amountPerPeriod}/periodo)`,
    });

    return deduction;
  }
}
