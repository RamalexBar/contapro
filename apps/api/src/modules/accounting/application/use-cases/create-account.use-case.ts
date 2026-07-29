import type { AuditService } from "../../../audit/application/audit.service";
import type { AccountRecord, CreateAccountData, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";

export class CreateAccountUseCase {
  constructor(private readonly repo: IChartOfAccountsRepository, private readonly audit: AuditService) {}

  async execute(data: CreateAccountData): Promise<AccountRecord> {
    const account = await this.repo.create(data);

    await this.audit.record({
      action: "ACCOUNT_CREATED",
      entityType: "ChartOfAccounts",
      entityId: account.id,
      description: `Cuenta creada: ${account.code} ${account.name}`,
    });

    return account;
  }
}
