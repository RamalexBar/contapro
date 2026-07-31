import type { AuditService } from "../../../audit/application/audit.service";
import type { BankReconciliationRecord, IBankReconciliationRepository } from "../../domain/bank-reconciliation.repository";

export class CloseBankReconciliationUseCase {
  constructor(private readonly repo: IBankReconciliationRepository, private readonly audit: AuditService) {}

  async execute(reconciliationId: string): Promise<BankReconciliationRecord> {
    const reconciliation = await this.repo.close(reconciliationId);
    const diff = reconciliation.statementBalance - reconciliation.bookBalance;

    await this.audit.record({
      action: "BANK_RECONCILIATION_CLOSED",
      entityType: "BankReconciliation",
      entityId: reconciliationId,
      description: `Conciliacion cerrada. Diferencia extracto vs libros: ${diff}`,
    });

    return reconciliation;
  }
}
