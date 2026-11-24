import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { CreateCreditNoteData, CreditNoteRecord, ICreditNoteRepository } from "../domain/credit-note.repository";

const include = { electronicCreditNote: { select: { fullNumber: true, status: true, rejectionReason: true } } } as const;

type Row = {
  id: string;
  saleId: string | null;
  returnId: string | null;
  conceptCode: string;
  amount: unknown;
  reason: string;
  status: string;
  createdAt: Date;
  electronicCreditNote: { fullNumber: string; status: string; rejectionReason: string | null } | null;
};

function toRecord(row: Row): CreditNoteRecord {
  return {
    id: row.id,
    saleId: row.saleId,
    returnId: row.returnId,
    conceptCode: row.conceptCode,
    amount: Number(row.amount),
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    electronic: row.electronicCreditNote,
  };
}

export class PrismaCreditNoteRepository implements ICreditNoteRepository {
  async create(data: CreateCreditNoteData): Promise<CreditNoteRecord> {
    const row = await prisma.creditNote.create({
      data: {
        companyId: getTenantContext().companyId,
        branchId: data.branchId,
        customerId: data.customerId,
        saleId: data.saleId,
        returnId: data.returnId ?? null,
        conceptCode: data.conceptCode,
        reason: data.reason,
        amount: data.amount,
      },
      include,
    });
    return toRecord(row);
  }

  async list(): Promise<CreditNoteRecord[]> {
    const rows = await prisma.creditNote.findMany({ orderBy: { createdAt: "desc" }, take: 50, include });
    return rows.map(toRecord);
  }

  async totalCreditedForSale(saleId: string): Promise<number> {
    const result = await prisma.creditNote.aggregate({ where: { saleId, companyId: getTenantContext().companyId }, _sum: { amount: true } });
    return Number(result._sum.amount ?? 0);
  }
}
