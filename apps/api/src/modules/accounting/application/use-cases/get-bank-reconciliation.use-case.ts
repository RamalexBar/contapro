import type { BankReconciliationRecord, IBankReconciliationRepository } from "../../domain/bank-reconciliation.repository";

export class GetBankReconciliationUseCase {
  constructor(private readonly repo: IBankReconciliationRepository) {}

  execute(id: string): Promise<BankReconciliationRecord> {
    return this.repo.findByIdOrThrow(id);
  }
}
