import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";

export class PayPayrollUseCase {
  constructor(private readonly repo: IPayrollRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<PayrollRecord> {
    const payroll = await this.repo.findByIdOrThrow(id);
    if (payroll.status !== "APPROVED") {
      throw new ValidationError(`Solo se puede pagar una nomina en estado APPROVED (actual: ${payroll.status})`);
    }

    const updated = await this.repo.updateStatus(id, "PAID", { paidAt: new Date() });

    await this.audit.record({
      action: "PAYROLL_PAID",
      entityType: "Payroll",
      entityId: updated.id,
      description: `Nomina marcada como pagada: ${updated.month}/${updated.year}`,
    });

    return updated;
  }
}
