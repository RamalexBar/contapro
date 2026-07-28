import type { ClockOutInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ForbiddenError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ITimeTrackingRepository, TimeEntryRecord } from "../../domain/timetracking.repository";

export class ClockOutUseCase {
  constructor(
    private readonly repo: ITimeTrackingRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(id: string, input: ClockOutInput): Promise<TimeEntryRecord> {
    const existing = await this.repo.findByIdOrThrow(id);
    const ctx = getTenantContext();
    if (!ctx.permissions.has("timetracking.manage")) {
      const employee = await this.employeeRepo.findByIdOrThrow(existing.employeeId);
      if (employee.userId !== ctx.userId) throw new ForbiddenError("Solo puedes marcar tu propia salida");
    }

    const entry = await this.repo.clockOut(id, input.clockOut ?? new Date());

    await this.audit.record({
      action: "TIME_ENTRY_CLOCK_OUT",
      entityType: "TimeEntry",
      entityId: entry.id,
      description: `Salida registrada para el empleado ${entry.employeeId}`,
    });

    return entry;
  }
}
