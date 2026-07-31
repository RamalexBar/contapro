import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  BankTransactionRecord,
  BankTransactionTypeSum,
  CreateBankTransactionData,
  IBankTransactionRepository,
} from "../domain/bank-transaction.repository";

function toRecord(row: { id: string; bankAccountId: string; date: Date; description: string; amount: unknown; type: string; reconciled: boolean }): BankTransactionRecord {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    date: row.date,
    description: row.description,
    amount: Number(row.amount),
    type: row.type,
    reconciled: row.reconciled,
  };
}

/** BankTransaction no tiene columna companyId propia (se aisla via la relacion a BankAccount, que
 * si la tiene) -- por eso este repo filtra explicitamente `bankAccount: { companyId }` en cada
 * consulta en vez de depender del filtro automatico de tenant.extension.ts. */
export class PrismaBankTransactionRepository implements IBankTransactionRepository {
  async create(data: CreateBankTransactionData): Promise<BankTransactionRecord> {
    const row = await prisma.bankTransaction.create({
      data: {
        bankAccountId: data.bankAccountId,
        date: data.date,
        description: data.description,
        amount: data.amount,
        type: data.type,
      },
    });
    return toRecord(row);
  }

  async list(bankAccountId: string): Promise<BankTransactionRecord[]> {
    const companyId = getTenantContext().companyId;
    const rows = await prisma.bankTransaction.findMany({
      where: { bankAccountId, bankAccount: { companyId } },
      orderBy: { date: "desc" },
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<BankTransactionRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.bankTransaction.findFirst({ where: { id, bankAccount: { companyId } } });
    if (!row) throw new NotFoundError("BankTransaction", id);
    return toRecord(row);
  }

  async markReconciled(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await prisma.bankTransaction.update({ where: { id }, data: { reconciled: true } });
  }

  async sumByType(from: Date, to: Date): Promise<BankTransactionTypeSum[]> {
    const companyId = getTenantContext().companyId;
    const grouped = await prisma.bankTransaction.groupBy({
      by: ["type"],
      where: { date: { gte: from, lte: to }, bankAccount: { companyId } },
      _sum: { amount: true },
    });
    return grouped.map((g) => ({ type: g.type, total: Number(g._sum.amount ?? 0) }));
  }
}
