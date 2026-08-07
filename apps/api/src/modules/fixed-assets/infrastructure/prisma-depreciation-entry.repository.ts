import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  DepreciationEntryRecord,
  DepreciationEntryStatus,
  IDepreciationEntryRepository,
  ListDepreciationEntriesFilter,
  MarkPostedData,
  UpsertDepreciationEntryForPeriodData,
} from "../domain/depreciation-entry.repository";

type EntryRow = {
  id: string;
  fixedAssetId: string;
  year: number;
  month: number;
  amount: Prisma.Decimal;
  status: string;
  calculatedAt: Date;
  postedAt: Date | null;
  journalEntryId: string | null;
};

function toRecord(row: EntryRow): DepreciationEntryRecord {
  return {
    id: row.id,
    fixedAssetId: row.fixedAssetId,
    year: row.year,
    month: row.month,
    amount: Number(row.amount),
    status: row.status as DepreciationEntryStatus,
    calculatedAt: row.calculatedAt,
    postedAt: row.postedAt,
    journalEntryId: row.journalEntryId,
  };
}

export class PrismaDepreciationEntryRepository implements IDepreciationEntryRepository {
  async upsertForPeriod(data: UpsertDepreciationEntryForPeriodData): Promise<DepreciationEntryRecord | null> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.depreciationEntry.findFirst({
        where: { fixedAssetId: data.fixedAssetId, year: data.year, month: data.month },
      });
      if (existing && existing.status === "POSTED") return null;

      const row = existing
        ? await tx.depreciationEntry.update({
            where: { id: existing.id },
            data: { amount: data.amount, calculatedAt: new Date() },
          })
        : await tx.depreciationEntry.create({
            data: { fixedAssetId: data.fixedAssetId, year: data.year, month: data.month, amount: data.amount },
          });
      return toRecord(row);
    });
  }

  async list(filter?: ListDepreciationEntriesFilter): Promise<DepreciationEntryRecord[]> {
    // DepreciationEntry no tiene companyId propio (fila hija, ver domain) -- se filtra via su
    // FixedAsset padre, mismo criterio que cualquier consulta directa a una tabla hija sin
    // pasar por su padre ya tenant-scopeado.
    const companyId = getTenantContext().companyId;
    const rows = await prisma.depreciationEntry.findMany({
      where: { fixedAsset: { companyId }, year: filter?.year, month: filter?.month, status: filter?.status },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<DepreciationEntryRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.depreciationEntry.findFirst({ where: { id, fixedAsset: { companyId } } });
    if (!row) throw new NotFoundError("DepreciationEntry", id);
    return toRecord(row);
  }

  async markPosted(id: string, data: MarkPostedData): Promise<DepreciationEntryRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.depreciationEntry.update({
      where: { id },
      data: { status: "POSTED", postedAt: data.postedAt, journalEntryId: data.journalEntryId },
    });
    return toRecord(row);
  }
}
