import type { AuditService } from "../../../audit/application/audit.service";
import type { AddBankReconciliationMatchData, BankReconciliationRecord, IBankReconciliationRepository } from "../../domain/bank-reconciliation.repository";

export class MatchBankReconciliationItemUseCase {
  constructor(private readonly repo: IBankReconciliationRepository, private readonly audit: AuditService) {}

  async execute(reconciliationId: string, data: AddBankReconciliationMatchData): Promise<BankReconciliationRecord> {
    const reconciliation = await this.repo.addMatch(reconciliationId, data);

    await this.audit.record({
      action: "BANK_RECONCILIATION_ITEM_MATCHED",
      entityType: "BankReconciliation",
      entityId: reconciliationId,
      description: `Item conciliado (bankTransactionId: ${data.bankTransactionId ?? "-"}, journalEntryLineId: ${data.journalEntryLineId ?? "-"})`,
    });

    return reconciliation;
  }
}
