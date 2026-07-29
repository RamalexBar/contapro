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
}

type ListFilter = { employeeId?: string; status?: string };

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
export function approveVacation(id: string): Promise<VacationRecord> {
  return apiFetch(`/vacations/${id}/approve`, { method: "POST" });
}
export function rejectVacation(id: string): Promise<VacationRecord> {
  return apiFetch(`/vacations/${id}/reject`, { method: "POST" });
}

export function listLeavePermissions(filter?: ListFilter): Promise<{ data: LeavePermissionRecord[] }> {
  return apiFetch(`/leave-permissions${toQuery(filter)}`);
}
export function requestLeavePermission(input: RequestLeavePermissionInput): Promise<LeavePermissionRecord> {
  return apiFetch("/leave-permissions", { method: "POST", body: input });
}
export function approveLeavePermission(id: string): Promise<LeavePermissionRecord> {
  return apiFetch(`/leave-permissions/${id}/approve`, { method: "POST" });
}
export function rejectLeavePermission(id: string): Promise<LeavePermissionRecord> {
  return apiFetch(`/leave-permissions/${id}/reject`, { method: "POST" });
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
export function approveSickLeave(id: string): Promise<SickLeaveRecord> {
  return apiFetch(`/sick-leaves/${id}/approve`, { method: "POST" });
}
export function rejectSickLeave(id: string): Promise<SickLeaveRecord> {
  return apiFetch(`/sick-leaves/${id}/reject`, { method: "POST" });
}
