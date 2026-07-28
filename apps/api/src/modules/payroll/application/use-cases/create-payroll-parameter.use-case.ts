import type { CreatePayrollParameterInput } from "@erp/shared-types";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPayrollParameterRepository, PayrollParameterRecord } from "../../domain/payroll-parameter.repository";

export class CreatePayrollParameterUseCase {
  constructor(private readonly repo: IPayrollParameterRepository, private readonly audit: AuditService) {}

  async execute(input: CreatePayrollParameterInput): Promise<PayrollParameterRecord> {
    const parameter = await this.repo.create({ ...input, effectiveTo: input.effectiveTo ?? null });

    await this.audit.record({
      action: "PAYROLL_PARAMETER_CREATED",
      entityType: "PayrollParameter",
      entityId: parameter.id,
      description: `Parametros legales de nomina creados para el año ${parameter.year}`,
    });

    return parameter;
  }
}
