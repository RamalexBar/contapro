import type { SubmitSickLeaveInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ForbiddenError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ITimeOffRepository, SickLeaveRecord } from "../../domain/time-off.repository";

export class SubmitSickLeaveUseCase {
  constructor(
    private readonly repo: ITimeOffRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: SubmitSickLeaveInput): Promise<SickLeaveRecord> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    const ctx = getTenantContext();
    if (!ctx.permissions.has("timeoff.manage") && employee.userId !== ctx.userId) {
      throw new ForbiddenError("Solo puedes radicar incapacidades para ti mismo");
    }
    if (input.endDate < input.startDate) {
      throw new ValidationError("La fecha de fin debe ser posterior a la fecha de inicio");
    }

    const sickLeave = await this.repo.createSickLeave(input);

    await this.audit.record({
      action: "SICK_LEAVE_SUBMITTED",
      entityType: "SickLeave",
      entityId: sickLeave.id,
      description: `Incapacidad ${input.type} radicada para ${employee.firstName} ${employee.lastName}`,
    });

    return sickLeave;
  }
}
