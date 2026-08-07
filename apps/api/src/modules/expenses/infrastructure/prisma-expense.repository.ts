import type { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreateExpenseData, ExpenseRecord, IExpenseRepository } from "../domain/expense.repository";

function toRecord(row: {
  id: string;
  branchId: string;
  expenseCategoryId: string;
  payeeName: string;
  description: string | null;
  date: Date;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  paymentMethod: string;
  costCenterId: string | null;
  status: string;
  journalEntryId: string | null;
  createdByUserId: string;
  createdAt: Date;
}): ExpenseRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    expenseCategoryId: row.expenseCategoryId,
    payeeName: row.payeeName,
    description: row.description,
    date: row.date,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    paymentMethod: row.paymentMethod,
    costCenterId: row.costCenterId,
    status: row.status,
    journalEntryId: row.journalEntryId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export class PrismaExpenseRepository implements IExpenseRepository {
  async create(data: CreateExpenseData): Promise<ExpenseRecord> {
    const row = await prisma.expense.create({
      data: {
        companyId: getTenantContext().companyId,
        branchId: data.branchId,
        expenseCategoryId: data.expenseCategoryId,
        payeeName: data.payeeName,
        description: data.description,
        date: data.date,
        subtotal: data.subtotal,
        taxTotal: data.taxTotal,
        total: data.total,
        paymentMethod: data.paymentMethod,
        costCenterId: data.costCenterId,
        status: "REGISTERED",
        createdByUserId: data.createdByUserId,
      },
    });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<ExpenseRecord> {
    const row = await prisma.expense.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Expense", id);
    return toRecord(row);
  }

  async list(filters: { take?: number; skip?: number }): Promise<ExpenseRecord[]> {
    const rows = await prisma.expense.findMany({
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });
    return rows.map(toRecord);
  }

  async setJournalEntryId(id: string, journalEntryId: string): Promise<void> {
    // findByIdOrThrow queda auto-scopeado por tenant.extension.ts (TENANT_MODELS); el update por
    // id que sigue no -- se confirma pertenencia al tenant primero, mismo criterio que
    // PrismaPurchaseRepository.setJournalEntryId.
    await this.findByIdOrThrow(id);
    await prisma.expense.update({ where: { id }, data: { journalEntryId } });
  }

  async cancel(id: string): Promise<ExpenseRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.expense.update({ where: { id }, data: { status: "CANCELLED" } });
    return toRecord(row);
  }
}
