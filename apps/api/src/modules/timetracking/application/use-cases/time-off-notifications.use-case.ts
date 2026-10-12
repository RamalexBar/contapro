import { getTenantContext } from "../../../../shared/context/request-context";
import type { ITimeOffRepository, UnseenTimeOffDecision } from "../../domain/time-off.repository";
import type { IEmployeeRepository } from "../../../employees/domain/employee.repository";

export interface TimeOffNotifications {
  /** Solo para quien aprueba (timeoff.manage): solicitudes pendientes de la empresa. */
  pending: { vacations: number; leavePermissions: number; sickLeaves: number; total: number } | null;
  /** Respuestas a las solicitudes del usuario (si esta vinculado a un empleado) que no ha visto. */
  decisions: UnseenTimeOffDecision[];
}

/** Avisos de vacaciones/permisos/incapacidades para el Dashboard y la pantalla de Vacaciones. */
export class TimeOffNotificationsUseCase {
  constructor(private readonly repo: ITimeOffRepository, private readonly employeeRepo: IEmployeeRepository) {}

  async execute(): Promise<TimeOffNotifications> {
    const ctx = getTenantContext();
    let pending: TimeOffNotifications["pending"] = null;
    if (ctx.permissions.has("timeoff.manage")) {
      const counts = await this.repo.countPending();
      pending = { ...counts, total: counts.vacations + counts.leavePermissions + counts.sickLeaves };
    }
    const employee = await this.employeeRepo.findByUserId(ctx.userId);
    const decisions = employee ? await this.repo.listUnseenDecisions(employee.id) : [];
    return { pending, decisions };
  }

  /** El empleado ya vio sus respuestas: el aviso deja de aparecer. */
  async markSeen(): Promise<void> {
    const employee = await this.employeeRepo.findByUserId(getTenantContext().userId);
    if (employee) await this.repo.markDecisionsSeen(employee.id);
  }
}
