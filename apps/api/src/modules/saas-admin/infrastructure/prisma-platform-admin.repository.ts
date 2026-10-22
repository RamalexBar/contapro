import { basePrisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { IPlatformAdminRepository, PlatformAdminRecord, PlatformAdminSummary } from "../domain/platform-admin.repository";

function toRecord(row: { id: string; email: string; passwordHash: string; fullName: string; isActive: boolean }): PlatformAdminRecord {
  return { id: row.id, email: row.email, passwordHash: row.passwordHash, fullName: row.fullName, isActive: row.isActive };
}

const summarySelect = { id: true, email: true, fullName: true, isActive: true, createdAt: true } as const;

/** basePrisma (no el cliente extendido): PlatformAdmin no tiene companyId, no aplica el filtro
 * de tenant.extension.ts. */
export class PrismaPlatformAdminRepository implements IPlatformAdminRepository {
  async findByEmail(email: string): Promise<PlatformAdminRecord | null> {
    const row = await basePrisma.platformAdmin.findUnique({ where: { email } });
    return row ? toRecord(row) : null;
  }

  async findByIdOrThrow(id: string): Promise<PlatformAdminRecord> {
    const row = await basePrisma.platformAdmin.findUnique({ where: { id } });
    if (!row) throw new NotFoundError("PlatformAdmin", id);
    return toRecord(row);
  }

  async list(): Promise<PlatformAdminSummary[]> {
    return basePrisma.platformAdmin.findMany({ select: summarySelect, orderBy: { createdAt: "asc" } });
  }

  async create(input: { email: string; passwordHash: string; fullName: string }): Promise<PlatformAdminSummary> {
    return basePrisma.platformAdmin.create({ data: input, select: summarySelect });
  }

  async setActive(id: string, isActive: boolean): Promise<PlatformAdminSummary> {
    await this.findByIdOrThrow(id);
    return basePrisma.platformAdmin.update({ where: { id }, data: { isActive }, select: summarySelect });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await basePrisma.platformAdmin.update({ where: { id }, data: { passwordHash } });
  }
}
