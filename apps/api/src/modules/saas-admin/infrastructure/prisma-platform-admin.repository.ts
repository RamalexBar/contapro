import { basePrisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { IPlatformAdminRepository, PlatformAdminRecord } from "../domain/platform-admin.repository";

function toRecord(row: { id: string; email: string; passwordHash: string; fullName: string; isActive: boolean }): PlatformAdminRecord {
  return { id: row.id, email: row.email, passwordHash: row.passwordHash, fullName: row.fullName, isActive: row.isActive };
}

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
}
