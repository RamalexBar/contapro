import type { RequestVacationInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ForbiddenError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { ITimeOffRepository, VacationRecord } from "../../domain/time-off.repository";
import { vacationBusinessDaysBetween } from "../../../payroll/application/payroll-novelties";

/**
 * Un usuario sin "timeoff.manage" solo puede solicitar vacaciones para si mismo (vinculo
 * Employee.userId), igual que el chequeo de auto-marcacion en ClockInUseCase.
 */
export class RequestVacationUseCase {
  constructor(
    private readonly repo: ITimeOffRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: RequestVacationInput): Promise<VacationRecord> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    const ctx = getTenantContext();
    if (!ctx.permissions.has("timeoff.manage") && employee.userId !== ctx.userId) {
      throw new ForbiddenError("Solo puedes solicitar vacaciones para ti mismo");
    }
    if (input.endDate < input.startDate) {
      throw new ValidationError("La fecha de fin debe ser posterior a la fecha de inicio");
    }

    // Las vacaciones se cuentan en dias habiles (art. 186 CST). Si no se indican, se calculan.
    const daysTaken = input.daysTaken ?? vacationBusinessDaysBetween(input.startDate, input.endDate);
    if (daysTaken <= 0) throw new ValidationError("Entre esas fechas no hay ningun dia habil");
    const vacation = await this.repo.createVacation({ ...input, daysTaken });

    await this.audit.record({
      action: "VACATION_REQUESTED",
      entityType: "Vacation",
      entityId: vacation.id,
      description: `Vacaciones solicitadas para ${employee.firstName} ${employee.lastName}`,
    });

    return vacation;
  }
}
