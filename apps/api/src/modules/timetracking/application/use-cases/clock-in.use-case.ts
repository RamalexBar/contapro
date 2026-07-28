import type { ClockInInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ForbiddenError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ITimeTrackingRepository, TimeEntryRecord } from "../../domain/timetracking.repository";

/**
 * Un usuario sin "timetracking.manage" solo puede marcar su propia entrada/salida (vinculo
 * Employee.userId): un Cajero/Empleado con solo "timetracking.clock" no puede marcar por otros.
 */
export class ClockInUseCase {
  constructor(
    private readonly repo: ITimeTrackingRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: ClockInInput): Promise<TimeEntryRecord> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    if (employee.status !== "ACTIVE") throw new ValidationError("El empleado no esta activo");

    const ctx = getTenantContext();
    if (!ctx.permissions.has("timetracking.manage") && employee.userId !== ctx.userId) {
      throw new ForbiddenError("Solo puedes marcar tu propia entrada");
    }

    const entry = await this.repo.clockIn(
      employee.id,
      employee.branchId,
      input.clockIn ?? new Date(),
      input.source,
      input.notes
    );

    await this.audit.record({
      action: "TIME_ENTRY_CLOCK_IN",
      entityType: "TimeEntry",
      entityId: entry.id,
      description: `Entrada registrada para ${employee.firstName} ${employee.lastName}`,
    });

    return entry;
  }
}
