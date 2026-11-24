import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { CreateDebitNoteData, DebitNoteRecord, IDebitNoteRepository } from "../domain/debit-note.repository";

const include = { electronicDebitNote: { select: { fullNumber: true, status: true, rejectionReason: true } } } as const;

type Row = {
  id: string;
  saleId: string | null;
  conceptCode: string;
  amount: unknown;
  reason: string;
  status: string;
  createdAt: Date;
  electronicDebitNote: { fullNumber: string; status: string; rejectionReason: string | null } | null;
};

function toRecord(row: Row): DebitNoteRecord {
  return {
    id: row.id,
    saleId: row.saleId,
    conceptCode: row.conceptCode,
    amount: Number(row.amount),
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    electronic: row.electronicDebitNote,
  };
}

export class PrismaDebitNoteRepository implements IDebitNoteRepository {
  async create(data: CreateDebitNoteData): Promise<DebitNoteRecord> {
    const row = await prisma.debitNote.create({
      data: {
        companyId: getTenantContext().companyId,
        branchId: data.branchId,
        customerId: data.customerId,
        saleId: data.saleId,
        conceptCode: data.conceptCode,
        reason: data.reason,
        amount: data.amount,
      },
      include,
    });
    return toRecord(row);
  }

  async list(): Promise<DebitNoteRecord[]> {
    const rows = await prisma.debitNote.findMany({ orderBy: { createdAt: "desc" }, take: 50, include });
    return rows.map(toRecord);
  }
}
