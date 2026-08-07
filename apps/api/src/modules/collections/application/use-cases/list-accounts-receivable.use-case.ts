import type { AccountReceivableRecord, IAccountReceivableRepository } from "../../domain/account-receivable.repository";

export class ListAccountsReceivableUseCase {
  constructor(private readonly repo: IAccountReceivableRepository) {}

  execute(filter?: { status?: string }): Promise<AccountReceivableRecord[]> {
    return this.repo.list(filter);
  }
}
