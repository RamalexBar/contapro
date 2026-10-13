import type {
  RegisterAbsenceInput,
  RequestLeavePermissionInput,
  RequestVacationInput,
  SubmitSickLeaveInput,
} from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export interface VacationRecord {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  daysTaken: number;
  status: string;
  approvedByUserId: string | null;
  /** Decision del administrador: nota (motivo del rechazo), fechas pedidas si se aprobo con otras. */
  decisionNote: string | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  decidedAt: string | null;
}

export interface LeavePermissionRecord {
  id: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  paid: boolean;
  status: string;
  approvedByUserId: string | null;
  /** Decision del administrador: nota (motivo del rechazo), fechas pedidas si se aprobo con otras. */
  decisionNote: string | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  decidedAt: string | null;
}

export interface AbsenceRecord {
  id: string;
  employeeId: string;
  date: string;
  type: string;
  reason: string | null;
}

export interface SickLeaveRecord {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  supportingDocUrl: string | null;
  status: string;
  /** Decision del administrador: nota (motivo del rechazo), fechas pedidas si se aprobo con otras. */
  decisionNote: string | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  decidedAt: string | null;
}

type ListFilter = { employeeId?: string; status?: string };

/** Aprobar tal cual, o con otras fechas (fechas YYYY-MM-DD), dias (vacaciones) y una nota. */
export interface ApproveTimeOffInput {
  startDate?: string;
  endDate?: string;
  daysTaken?: number;
  note?: string;
}

export type TimeOffKind = "vacation" | "leave-permission" | "sick-leave";

export interface TimeOffNotifications {
  pending: { vacations: number; leavePermissions: number; sickLeaves: number; total: number } | null;
  decisions: Array<{
    kind: TimeOffKind;
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    requestedStartDate: string | null;
    requestedEndDate: string | null;
    decisionNote: string | null;
    decidedAt: string;
  }>;
}

export function getTimeOffNotifications(): Promise<TimeOffNotifications> {
  return apiFetch("/time-off/notifications");
}

export function markTimeOffNotificationsSeen(): Promise<void> {
  return apiFetch("/time-off/notifications/seen", { method: "POST" });
}

function toQuery(filter?: ListFilter): string {
  const params = new URLSearchParams();
  if (filter?.employeeId) params.set("employeeId", filter.employeeId);
  if (filter?.status) params.set("status", filter.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listVacations(filter?: ListFilter): Promise<{ data: VacationRecord[] }> {
  return apiFetch(`/vacations${toQuery(filter)}`);
}
export function requestVacation(input: RequestVacationInput): Promise<VacationRecord> {
  return apiFetch("/vacations", { method: "POST", body: input });
}
export function approveVacation(id: string, input: ApproveTimeOffInput = {}): Promise<VacationRecord> {
  return apiFetch(`/vacations/${id}/approve`, { method: "POST", body: input });
}
export function rejectVacation(id: string, reason: string): Promise<VacationRecord> {
  return apiFetch(`/vacations/${id}/reject`, { method: "POST", body: { reason } });
}

export function listLeavePermissions(filter?: ListFilter): Promise<{ data: LeavePermissionRecord[] }> {
  return apiFetch(`/leave-permissions${toQuery(filter)}`);
}
export function requestLeavePermission(input: RequestLeavePermissionInput): Promise<LeavePermissionRecord> {
  return apiFetch("/leave-permissions", { method: "POST", body: input });
}
export function approveLeavePermission(id: string, input: ApproveTimeOffInput = {}): Promise<LeavePermissionRecord> {
  return apiFetch(`/leave-permissions/${id}/approve`, { method: "POST", body: input });
}
export function rejectLeavePermission(id: string, reason: string): Promise<LeavePermissionRecord> {
  return apiFetch(`/leave-permissions/${id}/reject`, { method: "POST", body: { reason } });
}

export function listAbsences(filter?: ListFilter): Promise<{ data: AbsenceRecord[] }> {
  return apiFetch(`/absences${toQuery(filter)}`);
}
export function registerAbsence(input: RegisterAbsenceInput): Promise<AbsenceRecord> {
  return apiFetch("/absences", { method: "POST", body: input });
}

export function listSickLeaves(filter?: ListFilter): Promise<{ data: SickLeaveRecord[] }> {
  return apiFetch(`/sick-leaves${toQuery(filter)}`);
}
export function submitSickLeave(input: SubmitSickLeaveInput): Promise<SickLeaveRecord> {
  return apiFetch("/sick-leaves", { method: "POST", body: input });
}
export function approveSickLeave(id: string, input: ApproveTimeOffInput = {}): Promise<SickLeaveRecord> {
  return apiFetch(`/sick-leaves/${id}/approve`, { method: "POST", body: input });
}
export function rejectSickLeave(id: string, reason: string): Promise<SickLeaveRecord> {
  return apiFetch(`/sick-leaves/${id}/reject`, { method: "POST", body: { reason } });
}
