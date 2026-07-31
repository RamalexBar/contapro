import type { AuditService } from "../../../audit/application/audit.service";
import type { IBankAccountRepository } from "../../domain/bank-account.repository";
import type { BankReconciliationRecord, IBankReconciliationRepository, StartBankReconciliationData } from "../../domain/bank-reconciliation.repository";

export class StartBankReconciliationUseCase {
  constructor(
    private readonly reconciliationRepo: IBankReconciliationRepository,
    private readonly bankAccountRepo: IBankAccountRepository,
    private readonly audit: AuditService
  ) {}

  async execute(data: StartBankReconciliationData): Promise<BankReconciliationRecord> {
    const account = await this.bankAccountRepo.findByIdOrThrow(data.bankAccountId);
    const reconciliation = await this.reconciliationRepo.start(data);

    await this.audit.record({
      action: "BANK_RECONCILIATION_STARTED",
      entityType: "BankReconciliation",
      entityId: reconciliation.id,
      description: `Conciliacion iniciada para ${account.bankName} ${account.accountNumber}: extracto ${data.statementBalance}, libros ${data.bookBalance}`,
    });

    return reconciliation;
  }
}
