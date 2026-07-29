import type { RequestLeavePermissionInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ForbiddenError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ITimeOffRepository, LeavePermissionRecord } from "../../domain/time-off.repository";

export class RequestLeavePermissionUseCase {
  constructor(
    private readonly repo: ITimeOffRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: RequestLeavePermissionInput): Promise<LeavePermissionRecord> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    const ctx = getTenantContext();
    if (!ctx.permissions.has("timeoff.manage") && employee.userId !== ctx.userId) {
      throw new ForbiddenError("Solo puedes solicitar permisos para ti mismo");
    }
    if (input.endDate < input.startDate) {
      throw new ValidationError("La fecha de fin debe ser posterior a la fecha de inicio");
    }

    const permission = await this.repo.createLeavePermission(input);

    await this.audit.record({
      action: "LEAVE_PERMISSION_REQUESTED",
      entityType: "LeavePermission",
      entityId: permission.id,
      description: `Permiso ${input.type} solicitado para ${employee.firstName} ${employee.lastName}`,
    });

    return permission;
  }
}
