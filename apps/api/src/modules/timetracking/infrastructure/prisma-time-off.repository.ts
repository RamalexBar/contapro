import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  AbsenceRecord,
  CreateAbsenceData,
  CreateLeavePermissionData,
  CreateSickLeaveData,
  CreateVacationData,
  ITimeOffRepository,
  LeavePermissionRecord,
  SickLeaveRecord,
  TimeOffDecision,
  UnseenTimeOffDecision,
  VacationRecord,
} from "../domain/time-off.repository";

/** Campos comunes de la decision; si cambian las fechas, guarda las pedidas. */
function decisionData(current: { startDate: Date; endDate: Date }, d: TimeOffDecision) {
  const datesChanged =
    (d.startDate && d.startDate.getTime() !== current.startDate.getTime()) ||
    (d.endDate && d.endDate.getTime() !== current.endDate.getTime());
  return {
    status: d.status,
    decisionNote: d.note ?? null,
    decidedAt: new Date(),
    decisionSeenAt: null,
    ...(datesChanged
      ? {
          requestedStartDate: current.startDate,
          requestedEndDate: current.endDate,
          startDate: d.startDate ?? current.startDate,
          endDate: d.endDate ?? current.endDate,
        }
      : {}),
  };
}

/**
 * Vacation/LeavePermission/Absence/SickLeave NO tienen columna companyId (igual que TimeEntry,
 * ver prisma-timetracking.repository.ts) por lo que se filtran a mano via `employee.companyId`.
 */
export class PrismaTimeOffRepository implements ITimeOffRepository {
  async createVacation(data: CreateVacationData): Promise<VacationRecord> {
    return prisma.vacation.create({ data });
  }

  async listVacations(filter?: { employeeId?: string; status?: string }): Promise<VacationRecord[]> {
    const companyId = getTenantContext().companyId;
    return prisma.vacation.findMany({
      where: { employeeId: filter?.employeeId, status: filter?.status, employee: { companyId } },
      orderBy: { startDate: "desc" },
    });
  }

  async findVacationByIdOrThrow(id: string): Promise<VacationRecord> {
    const companyId = getTenantContext().companyId;
    const vacation = await prisma.vacation.findFirst({ where: { id, employee: { companyId } } });
    if (!vacation) throw new NotFoundError("Vacation", id);
    return vacation;
  }

  async decideVacation(id: string, decision: TimeOffDecision): Promise<VacationRecord> {
    const current = await this.findVacationByIdOrThrow(id);
    return prisma.vacation.update({
      where: { id },
      data: {
        ...decisionData(current, decision),
        approvedByUserId: decision.approvedByUserId,
        ...(decision.daysTaken !== undefined ? { daysTaken: decision.daysTaken } : {}),
      },
    });
  }

  async createLeavePermission(data: CreateLeavePermissionData): Promise<LeavePermissionRecord> {
    return prisma.leavePermission.create({ data });
  }

  async listLeavePermissions(filter?: { employeeId?: string; status?: string }): Promise<LeavePermissionRecord[]> {
    const companyId = getTenantContext().companyId;
    return prisma.leavePermission.findMany({
      where: { employeeId: filter?.employeeId, status: filter?.status, employee: { companyId } },
      orderBy: { startDate: "desc" },
    });
  }

  async findLeavePermissionByIdOrThrow(id: string): Promise<LeavePermissionRecord> {
    const companyId = getTenantContext().companyId;
    const permission = await prisma.leavePermission.findFirst({ where: { id, employee: { companyId } } });
    if (!permission) throw new NotFoundError("LeavePermission", id);
    return permission;
  }

  async decideLeavePermission(id: string, decision: TimeOffDecision): Promise<LeavePermissionRecord> {
    const current = await this.findLeavePermissionByIdOrThrow(id);
    return prisma.leavePermission.update({
      where: { id },
      data: { ...decisionData(current, decision), approvedByUserId: decision.approvedByUserId },
    });
  }

  async createAbsence(data: CreateAbsenceData): Promise<AbsenceRecord> {
    return prisma.absence.create({ data });
  }

  async listAbsences(filter?: { employeeId?: string }): Promise<AbsenceRecord[]> {
    const companyId = getTenantContext().companyId;
    return prisma.absence.findMany({
      where: { employeeId: filter?.employeeId, employee: { companyId } },
      orderBy: { date: "desc" },
    });
  }

  async createSickLeave(data: CreateSickLeaveData): Promise<SickLeaveRecord> {
    return prisma.sickLeave.create({ data });
  }

  async listSickLeaves(filter?: { employeeId?: string; status?: string }): Promise<SickLeaveRecord[]> {
    const companyId = getTenantContext().companyId;
    return prisma.sickLeave.findMany({
      where: { employeeId: filter?.employeeId, status: filter?.status, employee: { companyId } },
      orderBy: { startDate: "desc" },
    });
  }

  async findSickLeaveByIdOrThrow(id: string): Promise<SickLeaveRecord> {
    const companyId = getTenantContext().companyId;
    const sickLeave = await prisma.sickLeave.findFirst({ where: { id, employee: { companyId } } });
    if (!sickLeave) throw new NotFoundError("SickLeave", id);
    return sickLeave;
  }

  async decideSickLeave(id: string, decision: TimeOffDecision): Promise<SickLeaveRecord> {
    const current = await this.findSickLeaveByIdOrThrow(id);
    return prisma.sickLeave.update({ where: { id }, data: decisionData(current, decision) });
  }

  async countPending(): Promise<{ vacations: number; leavePermissions: number; sickLeaves: number }> {
    const companyId = getTenantContext().companyId;
    const [vacations, leavePermissions, sickLeaves] = await Promise.all([
      prisma.vacation.count({ where: { status: "REQUESTED", employee: { companyId } } }),
      prisma.leavePermission.count({ where: { status: "REQUESTED", employee: { companyId } } }),
      prisma.sickLeave.count({ where: { status: "SUBMITTED", employee: { companyId } } }),
    ]);
    return { vacations, leavePermissions, sickLeaves };
  }

  async listUnseenDecisions(employeeId: string): Promise<UnseenTimeOffDecision[]> {
    const companyId = getTenantContext().companyId;
    const where = { employeeId, employee: { companyId }, decidedAt: { not: null }, decisionSeenAt: null };
    const select = {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      requestedStartDate: true,
      requestedEndDate: true,
      decisionNote: true,
      decidedAt: true,
    } as const;
    const [vacations, permissions, sickLeaves] = await Promise.all([
      prisma.vacation.findMany({ where, select }),
      prisma.leavePermission.findMany({ where, select }),
      prisma.sickLeave.findMany({ where, select }),
    ]);
    return [
      ...vacations.map((v) => ({ ...v, kind: "vacation" as const, decidedAt: v.decidedAt! })),
      ...permissions.map((p) => ({ ...p, kind: "leave-permission" as const, decidedAt: p.decidedAt! })),
      ...sickLeaves.map((s) => ({ ...s, kind: "sick-leave" as const, decidedAt: s.decidedAt! })),
    ].sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());
  }

  async markDecisionsSeen(employeeId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    const where = { employeeId, employee: { companyId }, decidedAt: { not: null }, decisionSeenAt: null };
    const data = { decisionSeenAt: new Date() };
    await Promise.all([
      prisma.vacation.updateMany({ where, data }),
      prisma.leavePermission.updateMany({ where, data }),
      prisma.sickLeave.updateMany({ where, data }),
    ]);
  }
}
