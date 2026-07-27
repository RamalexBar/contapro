import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { CreateCreditNoteData, CreditNoteRecord, ICreditNoteRepository } from "../domain/credit-note.repository";

export class PrismaCreditNoteRepository implements ICreditNoteRepository {
  async create(data: CreateCreditNoteData): Promise<CreditNoteRecord> {
    const row = await prisma.creditNote.create({
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

  async list(): Promise<CreditNoteRecord[]> {
    const rows = await prisma.creditNote.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((row) => ({ id: row.id, amount: Number(row.amount), reason: row.reason, status: row.status, createdAt: row.createdAt }));
  }
}
