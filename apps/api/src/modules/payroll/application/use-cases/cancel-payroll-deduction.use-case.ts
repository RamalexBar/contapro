import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPayrollDeductionRepository, PayrollDeductionRecord } from "../../domain/payroll-deduction.repository";

export class CancelPayrollDeductionUseCase {
  constructor(private readonly repo: IPayrollDeductionRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<PayrollDeductionRecord> {
    const existing = await this.repo.findByIdOrThrow(id);
    if (existing.status !== "ACTIVE") {
      throw new ValidationError(`Solo se puede cancelar una deduccion ACTIVE (actual: ${existing.status})`);
    }

    const cancelled = await this.repo.cancel(id);

    await this.audit.record({
      action: "PAYROLL_DEDUCTION_CANCELLED",
      entityType: "PayrollDeduction",
      entityId: id,
      description: `Deduccion cancelada: ${cancelled.description}`,
    });

    return cancelled;
  }
}
