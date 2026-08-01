import { z } from "zod";

/**
 * Valores legales de un año fiscal. Todos los porcentajes se envian como numero (ej. 4 = 4%).
 * IMPORTANTE: estos valores deben verificarse contra la legislacion vigente (Mintrabajo/DIAN)
 * del periodo que se va a liquidar antes de usarse en produccion — el seed solo trae un ejemplo.
 */
export const createPayrollParameterSchema = z.object({
  year: z.number().int().min(2000),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
  minimumWage: z.number().positive(),
  transportAllowance: z.number().nonnegative(),
  uvt: z.number().positive(),
  healthEmployeePercent: z.number().min(0).max(100),
  healthEmployerPercent: z.number().min(0).max(100),
  pensionEmployeePercent: z.number().min(0).max(100),
  pensionEmployerPercent: z.number().min(0).max(100),
  arlPercentByRiskLevel: z.record(z.string(), z.number().min(0).max(100)), // claves esperadas: I, II, III, IV, V
  severancePercent: z.number().min(0).max(100),
  severanceInterestPercent: z.number().min(0).max(100),
  serviceBonusPercent: z.number().min(0).max(100),
  vacationPercent: z.number().min(0).max(100),
  familyCompensationPercent: z.number().min(0).max(100),
  icbfPercent: z.number().min(0).max(100),
  senaPercent: z.number().min(0).max(100),
  overtimeDayPercent: z.number().min(0).max(300),
  overtimeNightPercent: z.number().min(0).max(300),
  nightSurchargePercent: z.number().min(0).max(300),
  sundayHolidaySurchargePercent: z.number().min(0).max(300),
  monthlyHoursDivisor: z.number().positive(),
});
export type CreatePayrollParameterInput = z.infer<typeof createPayrollParameterSchema>;

export const createPayrollSchema = z.object({
  branchId: z.string().uuid().optional(),
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
  periodType: z.enum(["MONTHLY", "BIWEEKLY"]).default("MONTHLY"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});
export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;

/**
 * Deduccion recurrente de un empleado (libranza/embargo), aplicada automaticamente en cada
 * periodo mientras este ACTIVE. `amountPerPeriod` es la cuota exacta acordada/ordenada -- no se
 * calcula ningun tope legal de embargabilidad, se registra el monto ya definido externamente
 * (credito o auto judicial). `totalAmount` es opcional: si se da, la deduccion se agota sola
 * cuando el saldo llega a 0; si no, es indefinida hasta que alguien la cancele manualmente
 * (tipico de un embargo sin monto total conocido de antemano).
 */
export const createPayrollDeductionSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(["LOAN_DEDUCTION", "GARNISHMENT"]),
  description: z.string().min(1),
  amountPerPeriod: z.number().positive(),
  totalAmount: z.number().positive().optional(),
  startDate: z.coerce.date(),
});
export type CreatePayrollDeductionInput = z.infer<typeof createPayrollDeductionSchema>;
