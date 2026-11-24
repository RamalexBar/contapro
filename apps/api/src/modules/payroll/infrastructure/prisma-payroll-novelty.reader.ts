import { prisma } from "../../../shared/prisma/prisma-client";
import type { PayrollNovelty } from "../application/payroll-novelties";
import type { IPayrollNoveltyReader } from "../domain/payroll-novelty.reader";

/** Vacaciones aprobadas o ya disfrutadas. */
const VACATION_STATUSES = ["APPROVED", "TAKEN"];

/**
 * Traduce los registros de Horarios/Vacaciones a novedades de nomina:
 * - SickLeave GENERAL -> incapacidad comun; LABOR_ARL -> incapacidad laboral; MATERNITY -> maternidad.
 * - LeavePermission MATERNITY/PATERNITY -> licencia de maternidad/paternidad (la paga la EPS, aunque
 *   se haya marcado como no remunerada); cualquier otra licencia no remunerada -> dias sin pago. Las
 *   licencias remuneradas (luto, calamidad, personales pagas) se pagan como dias trabajados.
 * - Absence UNJUSTIFIED -> un dia sin pago. Las justificadas no descuentan.
 */
export class PrismaPayrollNoveltyReader implements IPayrollNoveltyReader {
  async listForPeriod(employeeId: string, from: Date, to: Date): Promise<PayrollNovelty[]> {
    const overlaps = { startDate: { lte: to }, endDate: { gte: from } };
    const [sickLeaves, permissions, vacations, absences] = await Promise.all([
      prisma.sickLeave.findMany({ where: { employeeId, status: "APPROVED", ...overlaps } }),
      prisma.leavePermission.findMany({ where: { employeeId, status: "APPROVED", ...overlaps } }),
      prisma.vacation.findMany({ where: { employeeId, status: { in: VACATION_STATUSES }, ...overlaps } }),
      prisma.absence.findMany({ where: { employeeId, type: "UNJUSTIFIED", date: { gte: from, lte: to } } }),
    ]);

    const novelties: PayrollNovelty[] = [];
    for (const s of sickLeaves) {
      const kind = s.type === "LABOR_ARL" ? "SICK_LABOR" : s.type === "MATERNITY" ? "MATERNITY" : "SICK_GENERAL";
      novelties.push({ kind, startDate: s.startDate, endDate: s.endDate });
    }
    for (const p of permissions) {
      if (p.type === "MATERNITY") novelties.push({ kind: "MATERNITY", startDate: p.startDate, endDate: p.endDate });
      else if (p.type === "PATERNITY") novelties.push({ kind: "PATERNITY", startDate: p.startDate, endDate: p.endDate });
      else if (!p.paid) novelties.push({ kind: "UNPAID_LEAVE", startDate: p.startDate, endDate: p.endDate });
    }
    for (const v of vacations) novelties.push({ kind: "VACATION", startDate: v.startDate, endDate: v.endDate });
    for (const a of absences) novelties.push({ kind: "UNPAID_LEAVE", startDate: a.date, endDate: a.date });
    return novelties;
  }
}
