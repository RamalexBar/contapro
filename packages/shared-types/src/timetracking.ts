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
