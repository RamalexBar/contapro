import type { CloseCashSessionInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { PostCashSessionAdjustmentJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-cash-session-adjustment-journal-entry.use-case";
import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";

/** Registra hora de cierre, dinero final y la DIFERENCIA (arqueo) respecto a lo esperado. Si hay
 * diferencia, la contabiliza (sobrante/faltante) -- sin try/catch, mismo criterio que el resto de
 * comprobantes: es dinero real, no un efecto secundario que se pueda degradar. */
export class CloseCashSessionUseCase {
  constructor(
    private readonly repo: ICashSessionRepository,
    private readonly postCashSessionAdjustmentJournalEntry: PostCashSessionAdjustmentJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

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

    if (session.difference) {
      await this.postCashSessionAdjustmentJournalEntry.execute({
        cashSessionId: session.id,
        branchId: session.branchId,
        date: session.closedAt ?? new Date(),
        difference: session.difference,
      });
    }

    return session;
  }
}
