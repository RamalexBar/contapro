import type { CreatePayrollInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";

export class CreatePayrollUseCase {
  constructor(private readonly repo: IPayrollRepository, private readonly audit: AuditService) {}

  async execute(input: CreatePayrollInput): Promise<PayrollRecord> {
    const ctx = getTenantContext();
    const payroll = await this.repo.create({ ...input, createdByUserId: ctx.userId });

    await this.audit.record({
      action: "PAYROLL_CREATED",
      entityType: "Payroll",
      entityId: payroll.id,
      description: `Periodo de nomina creado: ${payroll.month}/${payroll.year} (${payroll.periodType})`,
    });

    return payroll;
  }
}
