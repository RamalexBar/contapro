import type { CloseCashSessionInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";

/** Registra hora de cierre, dinero final y la DIFERENCIA (arqueo) respecto a lo esperado. */
export class CloseCashSessionUseCase {
  constructor(private readonly repo: ICashSessionRepository, private readonly audit: AuditService) {}

  async execute(sessionId: string, input: CloseCashSessionInput): Promise<CashSessionRecord> {
    const userId = getTenantContext().userId;
    const session = await this.repo.close(sessionId, input.closingAmountCounted, userId, input.notes, input.counts);

    await this.audit.record({
      action: "CASH_SESSION_CLOSED",
      entityType: "CashSession",
      entityId: session.id,
      description: `Caja cerrada. Esperado: ${session.closingAmountExpected}, contado: ${session.closingAmountCounted}, diferencia: ${session.difference}`,
      metadata: {
        expected: session.closingAmountExpected,
        counted: session.closingAmountCounted,
        difference: session.difference,
      },
    });

    return session;
  }
}
