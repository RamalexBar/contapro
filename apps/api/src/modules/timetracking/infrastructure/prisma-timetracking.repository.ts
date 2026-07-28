import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error";
import type { ITimeTrackingRepository, TimeEntryRecord } from "../domain/timetracking.repository";

/**
 * TimeEntry NO tiene columna companyId (ver timetracking.prisma) por lo que NO esta cubierto por
 * la extension automatica de aislamiento multi-tenant (tenant.extension.ts). Todas las consultas
 * de este repositorio filtran a mano via la relacion `employee.companyId` para evitar que un
 * usuario de una empresa pueda leer/mutar marcaciones de otra empresa.
 */
export class PrismaTimeTrackingRepository implements ITimeTrackingRepository {
  async findOpenEntry(employeeId: string): Promise<TimeEntryRecord | null> {
    const companyId = getTenantContext().companyId;
    return prisma.timeEntry.findFirst({
      where: { employeeId, clockOut: null, employee: { companyId } },
      orderBy: { clockIn: "desc" },
    });
  }

  async clockIn(employeeId: string, branchId: string, clockIn: Date, source: string, notes?: string): Promise<TimeEntryRecord> {
    const open = await this.findOpenEntry(employeeId);
    if (open) throw new ValidationError("El empleado ya tiene una entrada abierta sin marcar salida");
    return prisma.timeEntry.create({ data: { employeeId, branchId, clockIn, source, notes } });
  }

  async clockOut(id: string, clockOut: Date): Promise<TimeEntryRecord> {
    const entry = await this.findByIdOrThrow(id);
    if (entry.clockOut) throw new ValidationError("Esta entrada ya tiene una salida registrada");
    if (clockOut <= entry.clockIn) throw new ValidationError("La hora de salida debe ser posterior a la hora de entrada");
    return prisma.timeEntry.update({ where: { id }, data: { clockOut } });
  }

  async findByIdOrThrow(id: string): Promise<TimeEntryRecord> {
    const companyId = getTenantContext().companyId;
    const entry = await prisma.timeEntry.findFirst({ where: { id, employee: { companyId } } });
    if (!entry) throw new NotFoundError("TimeEntry", id);
    return entry;
  }

  async list(filter: { employeeId?: string; from?: Date; to?: Date }): Promise<TimeEntryRecord[]> {
    const companyId = getTenantContext().companyId;
    return prisma.timeEntry.findMany({
      where: {
        employeeId: filter.employeeId,
        clockIn: { gte: filter.from, lte: filter.to },
        employee: { companyId },
      },
      orderBy: { clockIn: "desc" },
    });
  }

  async listClosedForPeriod(employeeId: string, from: Date, to: Date): Promise<TimeEntryRecord[]> {
    const companyId = getTenantContext().companyId;
    return prisma.timeEntry.findMany({
      where: { employeeId, clockOut: { not: null }, clockIn: { gte: from, lte: to }, employee: { companyId } },
      orderBy: { clockIn: "asc" },
    });
  }
}
