import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type {
  ITimeOffRepository,
  LeavePermissionRecord,
  SickLeaveRecord,
  VacationRecord,
} from "../../domain/time-off.repository";

export type TimeOffKind = "vacation" | "leave-permission" | "sick-leave";

const PENDING_STATUS: Record<TimeOffKind, string> = {
  vacation: "REQUESTED",
  "leave-permission": "REQUESTED",
  "sick-leave": "SUBMITTED",
};

/** Aprueba una solicitud de vacaciones/permiso/incapacidad. Requiere "timeoff.manage" en la ruta. */
export class ApproveTimeOffUseCase {
  constructor(private readonly repo: ITimeOffRepository, private readonly audit: AuditService) {}

  async execute(kind: TimeOffKind, id: string): Promise<VacationRecord | LeavePermissionRecord | SickLeaveRecord> {
    const ctx = getTenantContext();

    if (kind === "vacation") {
      const existing = await this.repo.findVacationByIdOrThrow(id);
      this.assertPending(kind, existing.status);
      const updated = await this.repo.updateVacationStatus(id, "APPROVED", ctx.userId);
      await this.audit.record({
        action: "VACATION_APPROVED",
        entityType: "Vacation",
        entityId: id,
        description: "Vacaciones aprobadas",
      });
      return updated;
    }

    if (kind === "leave-permission") {
      const existing = await this.repo.findLeavePermissionByIdOrThrow(id);
      this.assertPending(kind, existing.status);
      const updated = await this.repo.updateLeavePermissionStatus(id, "APPROVED", ctx.userId);
      await this.audit.record({
        action: "LEAVE_PERMISSION_APPROVED",
        entityType: "LeavePermission",
        entityId: id,
        description: "Permiso aprobado",
      });
      return updated;
    }

    const existing = await this.repo.findSickLeaveByIdOrThrow(id);
    this.assertPending(kind, existing.status);
    const updated = await this.repo.updateSickLeaveStatus(id, "APPROVED");
    await this.audit.record({
      action: "SICK_LEAVE_APPROVED",
      entityType: "SickLeave",
      entityId: id,
      description: "Incapacidad aprobada",
    });
    return updated;
  }

  private assertPending(kind: TimeOffKind, status: string): void {
    const expected = PENDING_STATUS[kind];
    if (status !== expected) {
      throw new ValidationError(`Solo se puede aprobar una solicitud en estado ${expected} (actual: ${status})`);
    }
  }
}
