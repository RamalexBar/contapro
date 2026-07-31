import type { AccountPayableRecord, IAccountPayableRepository } from "../../domain/account-payable.repository";

export class ListAccountsPayableUseCase {
  constructor(private readonly repo: IAccountPayableRepository) {}

  execute(status?: string): Promise<AccountPayableRecord[]> {
    return this.repo.list(status ? { status } : undefined);
  }
}
