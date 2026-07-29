import type { RegisterAbsenceInput } from "@erp/shared-types";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";
import type { AbsenceRecord, ITimeOffRepository } from "../../domain/time-off.repository";

/** Registrada siempre por un supervisor/administrador (requiere "timeoff.manage" en la ruta). */
export class RegisterAbsenceUseCase {
  constructor(
    private readonly repo: ITimeOffRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: RegisterAbsenceInput): Promise<AbsenceRecord> {
    const employee = await this.employeeRepo.findByIdOrThrow(input.employeeId);
    if (input.type === "JUSTIFIED" && !input.reason) {
      throw new ValidationError("Una ausencia justificada requiere indicar el motivo");
    }

    const absence = await this.repo.createAbsence(input);

    await this.audit.record({
      action: "ABSENCE_REGISTERED",
      entityType: "Absence",
      entityId: absence.id,
      description: `Ausencia ${input.type} registrada para ${employee.firstName} ${employee.lastName}`,
    });

    return absence;
  }
}
