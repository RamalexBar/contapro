import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type {
  ITimeOffRepository,
  LeavePermissionRecord,
  SickLeaveRecord,
  TimeOffKind,
  VacationRecord,
} from "../../domain/time-off.repository";
import { KIND_LABEL, assertPending } from "./approve-time-off.use-case";

const AUDIT_ACTION = {
  vacation: { action: "VACATION_REJECTED", entityType: "Vacation" },
  "leave-permission": { action: "LEAVE_PERMISSION_REJECTED", entityType: "LeavePermission" },
  "sick-leave": { action: "SICK_LEAVE_REJECTED", entityType: "SickLeave" },
} as const;

/** Rechaza una solicitud con el motivo, que el empleado ve en su aviso. Requiere "timeoff.manage". */
export class RejectTimeOffUseCase {
  constructor(private readonly repo: ITimeOffRepository, private readonly audit: AuditService) {}

  async execute(kind: TimeOffKind, id: string, reason: string): Promise<VacationRecord | LeavePermissionRecord | SickLeaveRecord> {
    const note = reason?.trim();
    if (!note) throw new ValidationError("Escribe el motivo del rechazo: el empleado lo va a ver");

    const existing =
      kind === "vacation"
        ? await this.repo.findVacationByIdOrThrow(id)
        : kind === "leave-permission"
          ? await this.repo.findLeavePermissionByIdOrThrow(id)
          : await this.repo.findSickLeaveByIdOrThrow(id);
    assertPending(kind, existing.status, "rechazar");

    const decision = { status: "REJECTED", note };
    const updated =
      kind === "vacation"
        ? await this.repo.decideVacation(id, decision)
        : kind === "leave-permission"
          ? await this.repo.decideLeavePermission(id, decision)
          : await this.repo.decideSickLeave(id, decision);

    await this.audit.record({ ...AUDIT_ACTION[kind], entityId: id, description: `${KIND_LABEL[kind]} rechazada: ${note}` });
    return updated;
  }
}
