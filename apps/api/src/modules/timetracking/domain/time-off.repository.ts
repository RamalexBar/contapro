export interface VacationRecord {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  daysTaken: number;
  status: string; // REQUESTED, APPROVED, REJECTED, TAKEN
  approvedByUserId: string | null;
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

export interface ITimeOffRepository {
  createVacation(data: CreateVacationData): Promise<VacationRecord>;
  listVacations(filter?: { employeeId?: string; status?: string }): Promise<VacationRecord[]>;
  findVacationByIdOrThrow(id: string): Promise<VacationRecord>;
  updateVacationStatus(id: string, status: string, approvedByUserId?: string): Promise<VacationRecord>;

  createLeavePermission(data: CreateLeavePermissionData): Promise<LeavePermissionRecord>;
  listLeavePermissions(filter?: { employeeId?: string; status?: string }): Promise<LeavePermissionRecord[]>;
  findLeavePermissionByIdOrThrow(id: string): Promise<LeavePermissionRecord>;
  updateLeavePermissionStatus(id: string, status: string, approvedByUserId?: string): Promise<LeavePermissionRecord>;

  createAbsence(data: CreateAbsenceData): Promise<AbsenceRecord>;
  listAbsences(filter?: { employeeId?: string }): Promise<AbsenceRecord[]>;

  createSickLeave(data: CreateSickLeaveData): Promise<SickLeaveRecord>;
  listSickLeaves(filter?: { employeeId?: string; status?: string }): Promise<SickLeaveRecord[]>;
  findSickLeaveByIdOrThrow(id: string): Promise<SickLeaveRecord>;
  updateSickLeaveStatus(id: string, status: string): Promise<SickLeaveRecord>;
}
