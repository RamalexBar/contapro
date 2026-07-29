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
  VacationRecord,
} from "../domain/time-off.repository";

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

  async updateVacationStatus(id: string, status: string, approvedByUserId?: string): Promise<VacationRecord> {
    await this.findVacationByIdOrThrow(id);
    return prisma.vacation.update({ where: { id }, data: { status, approvedByUserId } });
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

  async updateLeavePermissionStatus(
    id: string,
    status: string,
    approvedByUserId?: string
  ): Promise<LeavePermissionRecord> {
    await this.findLeavePermissionByIdOrThrow(id);
    return prisma.leavePermission.update({ where: { id }, data: { status, approvedByUserId } });
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

  async updateSickLeaveStatus(id: string, status: string): Promise<SickLeaveRecord> {
    await this.findSickLeaveByIdOrThrow(id);
    return prisma.sickLeave.update({ where: { id }, data: { status } });
  }
}
