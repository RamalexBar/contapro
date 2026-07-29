import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type {
  ITimeOffRepository,
  LeavePermissionRecord,
  SickLeaveRecord,
  VacationRecord,
} from "../../domain/time-off.repository";
import type { TimeOffKind } from "./approve-time-off.use-case";

const PENDING_STATUS: Record<TimeOffKind, string> = {
  vacation: "REQUESTED",
  "leave-permission": "REQUESTED",
  "sick-leave": "SUBMITTED",
};

/** Rechaza una solicitud de vacaciones/permiso/incapacidad. Requiere "timeoff.manage" en la ruta. */
export class RejectTimeOffUseCase {
  constructor(private readonly repo: ITimeOffRepository, private readonly audit: AuditService) {}

  async execute(kind: TimeOffKind, id: string): Promise<VacationRecord | LeavePermissionRecord | SickLeaveRecord> {
    if (kind === "vacation") {
      const existing = await this.repo.findVacationByIdOrThrow(id);
      this.assertPending(kind, existing.status);
      const updated = await this.repo.updateVacationStatus(id, "REJECTED");
      await this.audit.record({
        action: "VACATION_REJECTED",
        entityType: "Vacation",
        entityId: id,
        description: "Vacaciones rechazadas",
      });
      return updated;
    }

    if (kind === "leave-permission") {
      const existing = await this.repo.findLeavePermissionByIdOrThrow(id);
      this.assertPending(kind, existing.status);
      const updated = await this.repo.updateLeavePermissionStatus(id, "REJECTED");
      await this.audit.record({
        action: "LEAVE_PERMISSION_REJECTED",
        entityType: "LeavePermission",
        entityId: id,
        description: "Permiso rechazado",
      });
      return updated;
    }

    const existing = await this.repo.findSickLeaveByIdOrThrow(id);
    this.assertPending(kind, existing.status);
    const updated = await this.repo.updateSickLeaveStatus(id, "REJECTED");
    await this.audit.record({
      action: "SICK_LEAVE_REJECTED",
      entityType: "SickLeave",
      entityId: id,
      description: "Incapacidad rechazada",
    });
    return updated;
  }

  private assertPending(kind: TimeOffKind, status: string): void {
    const expected = PENDING_STATUS[kind];
    if (status !== expected) {
      throw new ValidationError(`Solo se puede rechazar una solicitud en estado ${expected} (actual: ${status})`);
    }
  }
}
