import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { BankAccountRecord, CreateBankAccountData, IBankAccountRepository } from "../domain/bank-account.repository";

function toRecord(row: { id: string; bankName: string; accountNumber: string; accountType: string; currentBalance: unknown }): BankAccountRecord {
  return {
    id: row.id,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountType: row.accountType,
    currentBalance: Number(row.currentBalance),
  };
}

export class PrismaBankAccountRepository implements IBankAccountRepository {
  async create(data: CreateBankAccountData): Promise<BankAccountRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.bankAccount.create({
      data: { companyId, bankName: data.bankName, accountNumber: data.accountNumber, accountType: data.accountType },
    });
    return toRecord(row);
  }

  async list(): Promise<BankAccountRecord[]> {
    const rows = await prisma.bankAccount.findMany({ orderBy: { bankName: "asc" } });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<BankAccountRecord> {
    const row = await prisma.bankAccount.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("BankAccount", id);
    return toRecord(row);
  }
}
