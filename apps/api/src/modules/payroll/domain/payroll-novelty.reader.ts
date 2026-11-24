import type { PayrollNovelty } from "../application/payroll-novelties";

/**
 * Novedades APROBADAS de un empleado que se cruzan con el periodo de nomina: incapacidades
 * (SickLeave), licencias (LeavePermission), vacaciones (Vacation) y ausencias injustificadas
 * (Absence). Las registra Horarios/Vacaciones; la nomina solo las lee.
 */
export interface IPayrollNoveltyReader {
  listForPeriod(employeeId: string, from: Date, to: Date): Promise<PayrollNovelty[]>;
}
