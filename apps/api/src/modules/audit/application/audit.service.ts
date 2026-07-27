import { getTenantContext } from "../../../shared/context/request-context";
import type { AuditAction, IAuditLogRepository } from "../domain/audit-log.repository";

export interface RecordAuditEventInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Servicio compartido de auditoria, usado por todos los modulos funcionales. Toma el
 * companyId/branchId/userId del contexto de la request actual automaticamente.
 */
export class AuditService {
  constructor(private readonly repo: IAuditLogRepository) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    const ctx = getTenantContext();
    await this.repo.create({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      ...input,
    });
  }

  /** Para el flujo de login/login fallido, donde aun no hay TenantContext establecido. */
  async recordWithoutContext(
    companyId: string,
    userId: string | null,
    input: RecordAuditEventInput,
    request?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await this.repo.create({
      companyId,
      branchId: null,
      userId,
      ipAddress: request?.ipAddress,
      userAgent: request?.userAgent,
      ...input,
    });
  }
}
