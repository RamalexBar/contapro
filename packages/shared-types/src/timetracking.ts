import { z } from "zod";

export const clockInSchema = z.object({
  employeeId: z.string().uuid(),
  clockIn: z.coerce.date().optional(), // por defecto "ahora", ver clock-in.use-case.ts
  source: z.enum(["MANUAL", "BIOMETRIC", "APP"]).default("MANUAL"),
  notes: z.string().optional(),
});
export type ClockInInput = z.infer<typeof clockInSchema>;

export const clockOutSchema = z.object({
  clockOut: z.coerce.date().optional(), // por defecto "ahora"
});
export type ClockOutInput = z.infer<typeof clockOutSchema>;

export const listTimeEntriesQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListTimeEntriesQuery = z.infer<typeof listTimeEntriesQuerySchema>;

export const requestVacationSchema = z.object({
  employeeId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  daysTaken: z.number().positive(),
});
export type RequestVacationInput = z.infer<typeof requestVacationSchema>;

export const requestLeavePermissionSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(["PERSONAL", "PATERNITY", "MATERNITY", "BEREAVEMENT", "OTHER"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  paid: z.boolean().default(false),
});
export type RequestLeavePermissionInput = z.infer<typeof requestLeavePermissionSchema>;

export const registerAbsenceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  type: z.enum(["UNJUSTIFIED", "JUSTIFIED"]),
  reason: z.string().optional(),
});
export type RegisterAbsenceInput = z.infer<typeof registerAbsenceSchema>;

export const submitSickLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  type: z.enum(["GENERAL", "LABOR_ARL", "MATERNITY"]),
  supportingDocUrl: z.string().optional(),
});
export type SubmitSickLeaveInput = z.infer<typeof submitSickLeaveSchema>;

export const listTimeOffQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.string().optional(),
});
export type ListTimeOffQuery = z.infer<typeof listTimeOffQuerySchema>;
