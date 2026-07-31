import type { AuditService } from "../../../audit/application/audit.service";
import type { BankAccountRecord, CreateBankAccountData, IBankAccountRepository } from "../../domain/bank-account.repository";

export class CreateBankAccountUseCase {
  constructor(private readonly repo: IBankAccountRepository, private readonly audit: AuditService) {}

  async execute(data: CreateBankAccountData): Promise<BankAccountRecord> {
    const account = await this.repo.create(data);

    await this.audit.record({
      action: "BANK_ACCOUNT_CREATED",
      entityType: "BankAccount",
      entityId: account.id,
      description: `Cuenta bancaria creada: ${account.bankName} ${account.accountNumber}`,
    });

    return account;
  }
}
