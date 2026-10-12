export interface VacationRecord {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  daysTaken: number;
  status: string; // REQUESTED, APPROVED, REJECTED, TAKEN
  approvedByUserId: string | null;
  requestedStartDate: Date | null;
  requestedEndDate: Date | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  decisionSeenAt: Date | null;
  createdAt: Date;
}

export interface LeavePermissionRecord {
  id: string;
  employeeId: string;
  type: string; // PERSONAL, PATERNITY, MATERNITY, BEREAVEMENT, OTHER
  startDate: Date;
  endDate: Date;
  paid: boolean;
  status: string; // REQUESTED, APPROVED, REJECTED
  approvedByUserId: string | null;
  requestedStartDate: Date | null;
  requestedEndDate: Date | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  decisionSeenAt: Date | null;
  createdAt: Date;
}

export interface AbsenceRecord {
  id: string;
  employeeId: string;
  date: Date;
  type: string; // UNJUSTIFIED, JUSTIFIED
  reason: string | null;
}

export interface SickLeaveRecord {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: string; // GENERAL, LABOR_ARL, MATERNITY
  supportingDocUrl: string | null;
  status: string; // SUBMITTED, APPROVED, REJECTED
  requestedStartDate: Date | null;
  requestedEndDate: Date | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  decisionSeenAt: Date | null;
  createdAt: Date;
}

export interface CreateVacationData {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  daysTaken: number;
}

export interface CreateLeavePermissionData {
  employeeId: string;
  type: string;
  startDate: Date;
  endDate: Date;
  paid: boolean;
}

export interface CreateAbsenceData {
  employeeId: string;
  date: Date;
  type: string;
  reason?: string;
}

export interface CreateSickLeaveData {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: string;
  supportingDocUrl?: string;
}

/** Decision del administrador. Con startDate/endDate (aprobar con otras fechas) las pedidas
 * quedan en requestedStartDate/requestedEndDate. */
export interface TimeOffDecision {
  status: string;
  approvedByUserId?: string;
  note?: string;
  startDate?: Date;
  endDate?: Date;
  /** Solo vacaciones: dias que se aprueban cuando cambian las fechas. */
  daysTaken?: number;
}

export type TimeOffKind = "vacation" | "leave-permission" | "sick-leave";

/** Decision que el empleado todavia no ha visto (aviso al entrar). */
export interface UnseenTimeOffDecision {
  kind: TimeOffKind;
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  requestedStartDate: Date | null;
  requestedEndDate: Date | null;
  decisionNote: string | null;
  decidedAt: Date;
}

export interface ITimeOffRepository {
  createVacation(data: CreateVacationData): Promise<VacationRecord>;
  listVacations(filter?: { employeeId?: string; status?: string }): Promise<VacationRecord[]>;
  findVacationByIdOrThrow(id: string): Promise<VacationRecord>;
  decideVacation(id: string, decision: TimeOffDecision): Promise<VacationRecord>;

  createLeavePermission(data: CreateLeavePermissionData): Promise<LeavePermissionRecord>;
  listLeavePermissions(filter?: { employeeId?: string; status?: string }): Promise<LeavePermissionRecord[]>;
  findLeavePermissionByIdOrThrow(id: string): Promise<LeavePermissionRecord>;
  decideLeavePermission(id: string, decision: TimeOffDecision): Promise<LeavePermissionRecord>;

  createAbsence(data: CreateAbsenceData): Promise<AbsenceRecord>;
  listAbsences(filter?: { employeeId?: string }): Promise<AbsenceRecord[]>;

  createSickLeave(data: CreateSickLeaveData): Promise<SickLeaveRecord>;
  listSickLeaves(filter?: { employeeId?: string; status?: string }): Promise<SickLeaveRecord[]>;
  findSickLeaveByIdOrThrow(id: string): Promise<SickLeaveRecord>;
  decideSickLeave(id: string, decision: TimeOffDecision): Promise<SickLeaveRecord>;

  /** Solicitudes pendientes de la empresa (aviso del Dashboard para quien aprueba). */
  countPending(): Promise<{ vacations: number; leavePermissions: number; sickLeaves: number }>;
  /** Decisiones sobre solicitudes de ese empleado que todavia no ha visto. */
  listUnseenDecisions(employeeId: string): Promise<UnseenTimeOffDecision[]>;
  markDecisionsSeen(employeeId: string): Promise<void>;
}
