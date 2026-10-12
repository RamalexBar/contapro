import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type {
  ITimeOffRepository,
  LeavePermissionRecord,
  SickLeaveRecord,
  TimeOffKind,
  VacationRecord,
} from "../../domain/time-off.repository";

export type { TimeOffKind };

export const PENDING_STATUS: Record<TimeOffKind, string> = {
  vacation: "REQUESTED",
  "leave-permission": "REQUESTED",
  "sick-leave": "SUBMITTED",
};

export const KIND_LABEL: Record<TimeOffKind, string> = {
  vacation: "Vacaciones",
  "leave-permission": "Permiso",
  "sick-leave": "Incapacidad",
};

/** Aprobar tal cual o con otras fechas (las pedidas quedan guardadas), con una nota opcional. */
export interface ApproveTimeOffInput {
  startDate?: Date;
  endDate?: Date;
  /** Solo vacaciones: dias aprobados cuando cambian las fechas. */
  daysTaken?: number;
  note?: string;
}

const AUDIT_ACTION = {
  vacation: { action: "VACATION_APPROVED", entityType: "Vacation" },
  "leave-permission": { action: "LEAVE_PERMISSION_APPROVED", entityType: "LeavePermission" },
  "sick-leave": { action: "SICK_LEAVE_APPROVED", entityType: "SickLeave" },
} as const;

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Aprueba una solicitud de vacaciones/permiso/incapacidad. Requiere "timeoff.manage" en la ruta. */
export class ApproveTimeOffUseCase {
  constructor(private readonly repo: ITimeOffRepository, private readonly audit: AuditService) {}

  async execute(
    kind: TimeOffKind,
    id: string,
    input: ApproveTimeOffInput = {}
  ): Promise<VacationRecord | LeavePermissionRecord | SickLeaveRecord> {
    const ctx = getTenantContext();
    const existing =
      kind === "vacation"
        ? await this.repo.findVacationByIdOrThrow(id)
        : kind === "leave-permission"
          ? await this.repo.findLeavePermissionByIdOrThrow(id)
          : await this.repo.findSickLeaveByIdOrThrow(id);
    assertPending(kind, existing.status, "aprobar");

    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    if (endDate.getTime() < startDate.getTime()) throw new ValidationError("La fecha final no puede ser anterior a la inicial");

    const decision = {
      status: "APPROVED",
      approvedByUserId: ctx.userId,
      note: input.note?.trim() || undefined,
      startDate: input.startDate,
      endDate: input.endDate,
      daysTaken: kind === "vacation" ? input.daysTaken : undefined,
    };
    const updated =
      kind === "vacation"
        ? await this.repo.decideVacation(id, decision)
        : kind === "leave-permission"
          ? await this.repo.decideLeavePermission(id, decision)
          : await this.repo.decideSickLeave(id, decision);

    const datesChanged = day(startDate) !== day(existing.startDate) || day(endDate) !== day(existing.endDate);
    await this.audit.record({
      ...AUDIT_ACTION[kind],
      entityId: id,
      description: datesChanged
        ? `${KIND_LABEL[kind]} aprobada del ${day(startDate)} al ${day(endDate)} (pedida del ${day(existing.startDate)} al ${day(existing.endDate)})`
        : `${KIND_LABEL[kind]} aprobada`,
    });
    return updated;
  }
}

export function assertPending(kind: TimeOffKind, status: string, verb: string): void {
  const expected = PENDING_STATUS[kind];
  if (status !== expected) {
    throw new ValidationError(`Solo se puede ${verb} una solicitud pendiente (esta ya esta ${status === "APPROVED" ? "aprobada" : status === "REJECTED" ? "rechazada" : status})`);
  }
}
