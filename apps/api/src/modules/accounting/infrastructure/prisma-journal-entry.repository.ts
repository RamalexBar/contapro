import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateJournalEntryData,
  IJournalEntryRepository,
  JournalEntryRecord,
  PostedLineAggregate,
} from "../domain/journal-entry.repository";

type EntryRow = {
  id: string;
  number: number;
  date: Date;
  description: string;
  type: string;
  sourceType: string | null;
  sourceId: string | null;
  status: string;
  createdByUserId: string;
  postedAt: Date | null;
  lines: { id: string; accountId: string; debit: unknown; credit: unknown; description: string | null }[];
};

function toRecord(row: EntryRow): JournalEntryRecord {
  return {
    id: row.id,
    number: row.number,
    date: row.date,
    description: row.description,
    type: row.type,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    status: row.status,
    createdByUserId: row.createdByUserId,
    postedAt: row.postedAt,
    lines: row.lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      debit: Number(l.debit),
      credit: Number(l.credit),
      description: l.description,
    })),
  };
}

/**
 * JournalEntryLine no tiene columna companyId (ver accounting.prisma), igual que TimeEntry:
 * las consultas se filtran a mano via la relacion journalEntry.companyId.
 */
export class PrismaJournalEntryRepository implements IJournalEntryRepository {
  async create(data: CreateJournalEntryData): Promise<JournalEntryRecord> {
    return prisma.$transaction(async (tx) => {
      const last = await tx.journalEntry.findFirst({ orderBy: { number: "desc" } });
      const number = (last?.number ?? 0) + 1;
      const entry = await tx.journalEntry.create({
        data: {
          companyId: getTenantContext().companyId,
          branchId: data.branchId,
          number,
          date: data.date,
          description: data.description,
          type: data.type,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          createdByUserId: data.createdByUserId,
          lines: {
            create: data.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          },
        },
        include: { lines: true },
      });
      return toRecord(entry);
    });
  }

  async list(filter?: { status?: string }): Promise<JournalEntryRecord[]> {
    const rows = await prisma.journalEntry.findMany({
      where: { status: filter?.status },
      include: { lines: true },
      orderBy: { number: "desc" },
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<JournalEntryRecord> {
    const row = await prisma.journalEntry.findFirst({ where: { id }, include: { lines: true } });
    if (!row) throw new NotFoundError("JournalEntry", id);
    return toRecord(row);
  }

  async updateStatus(id: string, status: string, postedAt?: Date): Promise<JournalEntryRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.journalEntry.update({
      where: { id },
      data: { status, postedAt },
      include: { lines: true },
    });
    return toRecord(row);
  }

  async listPostedLines(filter: { from?: Date; to?: Date; accountId?: string }): Promise<PostedLineAggregate[]> {
    const companyId = getTenantContext().companyId;
    const rows = await prisma.journalEntryLine.findMany({
      where: {
        accountId: filter.accountId,
        journalEntry: {
          companyId,
          status: "POSTED",
          date: { gte: filter.from, lte: filter.to },
        },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { date: "asc" } },
    });
    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      debit: Number(r.debit),
      credit: Number(r.credit),
      date: r.journalEntry.date,
      entryId: r.journalEntryId,
      entryNumber: r.journalEntry.number,
      description: r.description,
    }));
  }

  async findBySource(sourceType: string, sourceId: string): Promise<JournalEntryRecord | null> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.journalEntry.findFirst({
      where: { companyId, sourceType, sourceId },
      include: { lines: true },
    });
    return row ? toRecord(row) : null;
  }

  async hasDraftEntriesInPeriod(year: number, month: number): Promise<boolean> {
    const companyId = getTenantContext().companyId;
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const count = await prisma.journalEntry.count({
      where: { companyId, status: "DRAFT", date: { gte: start, lt: end } },
    });
    return count > 0;
  }
}
