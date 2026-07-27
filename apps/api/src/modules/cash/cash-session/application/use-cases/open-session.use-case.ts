import type { OpenCashSessionInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";

/** Regla del spec: cada apertura de caja queda asociada al empleado (responsable) que la abre. */
export class OpenCashSessionUseCase {
  constructor(private readonly repo: ICashSessionRepository, private readonly audit: AuditService) {}

  async execute(input: OpenCashSessionInput): Promise<CashSessionRecord> {
    const ctx = getTenantContext();
    if (!ctx.branchId) throw new ValidationError("El usuario no tiene una sucursal activa");

    const session = await this.repo.open(input.cashRegisterId, ctx.branchId, input.openingAmount, ctx.userId);

    await this.audit.record({
      action: "CASH_SESSION_OPENED",
      entityType: "CashSession",
      entityId: session.id,
      description: `Caja abierta con ${input.openingAmount} por el responsable`,
      metadata: { openingAmount: input.openingAmount },
    });

    return session;
  }
}
