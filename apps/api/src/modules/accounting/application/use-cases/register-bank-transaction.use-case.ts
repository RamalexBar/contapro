import type { AuditService } from "../../../audit/application/audit.service";
import type { IBankAccountRepository } from "../../domain/bank-account.repository";
import type { BankTransactionRecord, CreateBankTransactionData, IBankTransactionRepository } from "../../domain/bank-transaction.repository";

/**
 * BankTransaction no tiene columna companyId propia (ver domain/bank-transaction.repository.ts),
 * asi que la pertenencia al tenant se confirma aqui, llamando a bankAccountRepo.findByIdOrThrow
 * (si el bankAccountId no es de esta empresa, lanza NotFoundError) antes de crear la transaccion.
 */
export class RegisterBankTransactionUseCase {
  constructor(
    private readonly bankTransactionRepo: IBankTransactionRepository,
    private readonly bankAccountRepo: IBankAccountRepository,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreateBankTransactionData): Promise<BankTransactionRecord> {
    await this.bankAccountRepo.findByIdOrThrow(data.bankAccountId);
    const transaction = await this.bankTransactionRepo.create(data);

    await this.audit.record({
      action: "BANK_TRANSACTION_REGISTERED",
      entityType: "BankTransaction",
      entityId: transaction.id,
      description: `Movimiento bancario registrado: ${transaction.type} ${transaction.amount}`,
    });

    return transaction;
  }
}
