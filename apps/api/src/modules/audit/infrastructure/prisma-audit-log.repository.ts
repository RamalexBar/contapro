import { prisma } from "../../../shared/prisma/prisma-client";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository, ListAuditLogFilters } from "../domain/audit-log.repository";

export class PrismaAuditLogRepository implements IAuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    const row = await prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        description: input.description,
        metadata: input.metadata as never,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
    return row as unknown as AuditLogEntry;
  }

  async list(filters: ListAuditLogFilters): Promise<AuditLogEntry[]> {
    const rows = await prisma.auditLog.findMany({
      where: {
        companyId: filters.companyId,
        entityType: filters.entityType,
        entityId: filters.entityId,
        action: filters.action,
      },
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });
    return rows as unknown as AuditLogEntry[];
  }
}
