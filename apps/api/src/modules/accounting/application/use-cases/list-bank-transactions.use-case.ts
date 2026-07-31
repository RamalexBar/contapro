import type { IBankAccountRepository } from "../../domain/bank-account.repository";
import type { BankTransactionRecord, IBankTransactionRepository } from "../../domain/bank-transaction.repository";

export class ListBankTransactionsUseCase {
  constructor(
    private readonly bankTransactionRepo: IBankTransactionRepository,
    private readonly bankAccountRepo: IBankAccountRepository
  ) {}

  async execute(bankAccountId: string): Promise<BankTransactionRecord[]> {
    await this.bankAccountRepo.findByIdOrThrow(bankAccountId);
    return this.bankTransactionRepo.list(bankAccountId);
  }
}
