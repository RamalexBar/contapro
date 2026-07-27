import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { CreateDebitNoteData, DebitNoteRecord, IDebitNoteRepository } from "../domain/debit-note.repository";

export class PrismaDebitNoteRepository implements IDebitNoteRepository {
  async create(data: CreateDebitNoteData): Promise<DebitNoteRecord> {
    const row = await prisma.debitNote.create({
      data: {
        companyId: getTenantContext().companyId,
        branchId: data.branchId,
        customerId: data.customerId,
        saleId: data.saleId,
        reason: data.reason,
        amount: data.amount,
      },
    });
    return { id: row.id, amount: Number(row.amount), reason: row.reason, status: row.status, createdAt: row.createdAt };
  }

  async list(): Promise<DebitNoteRecord[]> {
    const rows = await prisma.debitNote.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((row) => ({ id: row.id, amount: Number(row.amount), reason: row.reason, status: row.status, createdAt: row.createdAt }));
  }
}
