import type { BankReconciliationRecord, IBankReconciliationRepository } from "../../domain/bank-reconciliation.repository";

export class ListBankReconciliationsUseCase {
  constructor(private readonly repo: IBankReconciliationRepository) {}

  execute(): Promise<BankReconciliationRecord[]> {
    return this.repo.list();
  }
}
