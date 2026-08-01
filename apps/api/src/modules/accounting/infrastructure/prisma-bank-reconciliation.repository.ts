import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error";
import type {
  AddBankReconciliationMatchData,
  BankReconciliationRecord,
  IBankReconciliationRepository,
  StartBankReconciliationData,
} from "../domain/bank-reconciliation.repository";

type ReconciliationRow = {
  id: string;
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  statementBalance: unknown;
  bookBalance: unknown;
  status: string;
  createdAt: Date;
  items: { id: string; bankTransactionId: string | null; journalEntryLineId: string | null; matched: boolean }[];
};

function toRecord(row: ReconciliationRow): BankReconciliationRecord {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    statementBalance: Number(row.statementBalance),
    bookBalance: Number(row.bookBalance),
    status: row.status,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      bankTransactionId: item.bankTransactionId,
      journalEntryLineId: item.journalEntryLineId,
      matched: item.matched,
    })),
  };
}

const INCLUDE = { items: true } as const;

/** BankReconciliation no tiene columna companyId propia (se aisla via la relacion a BankAccount).
 * `bankAccountRepo.findByIdOrThrow` ya la valida antes de llegar aqui (via el caso de uso), pero
 * las consultas por id de este repo tambien filtran `bankAccount: { companyId }` por defensa en
 * profundidad. */
export class PrismaBankReconciliationRepository implements IBankReconciliationRepository {
  async start(data: StartBankReconciliationData): Promise<BankReconciliationRecord> {
    const row = await prisma.bankReconciliation.create({
      data: {
        bankAccountId: data.bankAccountId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        statementBalance: data.statementBalance,
        bookBalance: data.bookBalance,
        status: "IN_PROGRESS",
      },
      include: INCLUDE,
    });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<BankReconciliationRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.bankReconciliation.findFirst({
      where: { id, bankAccount: { companyId } },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundError("BankReconciliation", id);
    return toRecord(row);
  }

  async list(): Promise<BankReconciliationRecord[]> {
    const companyId = getTenantContext().companyId;
    const rows = await prisma.bankReconciliation.findMany({
      where: { bankAccount: { companyId } },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async addMatch(reconciliationId: string, data: AddBankReconciliationMatchData): Promise<BankReconciliationRecord> {
    if (!data.bankTransactionId && !data.journalEntryLineId) {
      throw new ValidationError("Debes indicar bankTransactionId y/o journalEntryLineId");
    }
    await this.findByIdOrThrow(reconciliationId);

    await prisma.$transaction(async (tx) => {
      await tx.bankReconciliationItem.create({
        data: {
          reconciliationId,
          bankTransactionId: data.bankTransactionId,
          journalEntryLineId: data.journalEntryLineId,
          matched: true,
        },
      });
      if (data.bankTransactionId) {
        await tx.bankTransaction.update({ where: { id: data.bankTransactionId }, data: { reconciled: true } });
      }
    });

    return this.findByIdOrThrow(reconciliationId);
  }

  async close(reconciliationId: string): Promise<BankReconciliationRecord> {
    const current = await this.findByIdOrThrow(reconciliationId);
    if (current.status !== "IN_PROGRESS") {
      throw new ValidationError(`Solo se puede cerrar una conciliacion en estado IN_PROGRESS (actual: ${current.status})`);
    }
    await prisma.bankReconciliation.update({ where: { id: reconciliationId }, data: { status: "COMPLETED" } });
    return this.findByIdOrThrow(reconciliationId);
  }

  async listMatchedJournalEntryLineIds(): Promise<string[]> {
    const companyId = getTenantContext().companyId;
    const rows = await prisma.bankReconciliationItem.findMany({
      where: { matched: true, journalEntryLineId: { not: null }, reconciliation: { bankAccount: { companyId } } },
      select: { journalEntryLineId: true },
    });
    return rows.map((r) => r.journalEntryLineId).filter((id): id is string => id !== null);
  }
}
