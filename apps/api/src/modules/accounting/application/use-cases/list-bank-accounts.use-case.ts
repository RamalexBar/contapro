import type { BankAccountRecord, IBankAccountRepository } from "../../domain/bank-account.repository";

export class ListBankAccountsUseCase {
  constructor(private readonly repo: IBankAccountRepository) {}

  execute(): Promise<BankAccountRecord[]> {
    return this.repo.list();
  }
}
