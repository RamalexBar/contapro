import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";

export class ApprovePayrollUseCase {
  constructor(private readonly repo: IPayrollRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<PayrollRecord> {
    const payroll = await this.repo.findByIdOrThrow(id);
    if (payroll.status !== "CALCULATED") {
      throw new ValidationError(`Solo se puede aprobar una nomina en estado CALCULATED (actual: ${payroll.status})`);
    }

    const updated = await this.repo.updateStatus(id, "APPROVED");

    await this.audit.record({
      action: "PAYROLL_APPROVED",
      entityType: "Payroll",
      entityId: updated.id,
      description: `Nomina aprobada: ${updated.month}/${updated.year}`,
    });

    return updated;
  }
}
