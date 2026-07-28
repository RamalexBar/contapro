import type { ClockInInput, ClockOutInput } from "@erp/shared-types";
import { apiFetch, ApiError } from "../../../lib/api-client";
import type { EmployeeRecord } from "../../employees/api/employee.api";

export interface TimeEntryRecord {
  id: string;
  employeeId: string;
  branchId: string;
  clockIn: string;
  clockOut: string | null;
  source: string;
  notes: string | null;
}

export function listTimeEntries(filter?: {
  employeeId?: string;
  from?: string;
  to?: string;
}): Promise<{ data: TimeEntryRecord[] }> {
  const params = new URLSearchParams();
  if (filter?.employeeId) params.set("employeeId", filter.employeeId);
  if (filter?.from) params.set("from", filter.from);
  if (filter?.to) params.set("to", filter.to);
  const query = params.toString();
  return apiFetch(`/time-entries${query ? `?${query}` : ""}`);
}

export function clockIn(input: ClockInInput): Promise<TimeEntryRecord> {
  return apiFetch("/time-entries/clock-in", { method: "POST", body: input });
}

export function clockOut(id: string, input: ClockOutInput): Promise<TimeEntryRecord> {
  return apiFetch(`/time-entries/${id}/clock-out`, { method: "POST", body: input });
}

export async function getMyEmployee(): Promise<EmployeeRecord | null> {
  try {
    return await apiFetch<EmployeeRecord>("/employees/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function getMyOpenEntry(): Promise<TimeEntryRecord | null> {
  return apiFetch("/time-entries/my-open");
}
