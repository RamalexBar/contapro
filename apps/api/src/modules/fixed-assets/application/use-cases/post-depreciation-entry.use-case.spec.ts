import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { PostDepreciationJournalEntryUseCase } from "../../../accounting/application/use-cases/post-depreciation-journal-entry.use-case";
import type { FixedAssetRecord, IFixedAssetRepository } from "../../domain/fixed-asset.repository";
import type { DepreciationEntryRecord, IDepreciationEntryRepository, MarkPostedData } from "../../domain/depreciation-entry.repository";
import { PostDepreciationEntryUseCase } from "./post-depreciation-entry.use-case";

const ENTRY_CALCULATED: DepreciationEntryRecord = {
  id: "entry-1",
  fixedAssetId: "asset-1",
  year: 2026,
  month: 6,
  amount: 500_000,
  status: "CALCULATED",
  calculatedAt: new Date(2026, 5, 30),
  postedAt: null,
  journalEntryId: null,
};

const ASSET: FixedAssetRecord = {
  id: "asset-1",
  branchId: "branch-1",
  name: "Impresora industrial",
  description: null,
  purchaseDate: new Date(2026, 0, 1),
  cost: 12_000_000,
  salvageValue: 0,
  usefulLifeMonths: 24,
  accumulatedDepreciation: 0,
  isActive: true,
  createdAt: new Date(2026, 0, 1),
};

class FakeDepreciationEntryRepository implements Partial<IDepreciationEntryRepository> {
  constructor(private entry: DepreciationEntryRecord) {}
  marked: { id: string; data: MarkPostedData }[] = [];

  async findByIdOrThrow(id: string): Promise<DepreciationEntryRecord> {
    if (id !== this.entry.id) throw new Error("not found");
    return this.entry;
  }
  async markPosted(id: string, data: MarkPostedData): Promise<DepreciationEntryRecord> {
    this.marked.push({ id, data });
    this.entry = { ...this.entry, status: "POSTED", postedAt: data.postedAt, journalEntryId: data.journalEntryId };
    return this.entry;
  }
}

class FakeFixedAssetRepository implements Partial<IFixedAssetRepository> {
  constructor(private asset: FixedAssetRecord) {}
  incremented: { id: string; amount: number }[] = [];

  async findByIdOrThrow(id: string): Promise<FixedAssetRecord> {
    if (id !== this.asset.id) throw new Error("not found");
    return this.asset;
  }
  async incrementAccumulatedDepreciation(id: string, amount: number): Promise<FixedAssetRecord> {
    this.incremented.push({ id, amount });
    this.asset = { ...this.asset, accumulatedDepreciation: this.asset.accumulatedDepreciation + amount };
    return this.asset;
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  entries: CreateAuditLogInput[] = [];
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.entries.push(input);
    return { id: `audit-${this.entries.length}`, metadata: input.metadata ?? null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

function makeUseCase(entry: DepreciationEntryRecord, journalEntryResult: { id: string } | null = { id: "je-1" }) {
  const entryRepo = new FakeDepreciationEntryRepository(entry);
  const fixedAssetRepo = new FakeFixedAssetRepository(ASSET);
  const auditRepo = new FakeAuditLogRepository();
  const postDepreciationJournalEntry = {
    execute: vi.fn().mockResolvedValue(journalEntryResult),
  } as unknown as PostDepreciationJournalEntryUseCase;

  const useCase = new PostDepreciationEntryUseCase(
    entryRepo as unknown as IDepreciationEntryRepository,
    fixedAssetRepo as unknown as IFixedAssetRepository,
    postDepreciationJournalEntry,
    new AuditService(auditRepo)
  );

  return { useCase, entryRepo, fixedAssetRepo, postDepreciationJournalEntry };
}

describe("PostDepreciationEntryUseCase", () => {
  it("posts a CALCULATED entry: books the journal entry, increments the asset's accumulated depreciation, and marks it POSTED", async () => {
    const { useCase, entryRepo, fixedAssetRepo, postDepreciationJournalEntry } = makeUseCase(ENTRY_CALCULATED);

    const result = await withTenantContext(() => useCase.execute("entry-1"));

    expect(postDepreciationJournalEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({ depreciationEntryId: "entry-1", branchId: "branch-1", assetName: "Impresora industrial", amount: 500_000 })
    );
    expect(result.status).toBe("POSTED");
    expect(entryRepo.marked[0].data.journalEntryId).toBe("je-1");
    expect(fixedAssetRepo.incremented).toEqual([{ id: "asset-1", amount: 500_000 }]);
  });

  it("rejects posting an entry that is already POSTED", async () => {
    const posted: DepreciationEntryRecord = { ...ENTRY_CALCULATED, status: "POSTED", journalEntryId: "je-old" };
    const { useCase } = makeUseCase(posted);

    await expect(withTenantContext(() => useCase.execute("entry-1"))).rejects.toThrow(/ya esta en estado/);
  });

  it("rejects posting an entry that does not exist", async () => {
    const { useCase } = makeUseCase(ENTRY_CALCULATED);

    await expect(withTenantContext(() => useCase.execute("not-a-real-id"))).rejects.toThrow(/not found/);
  });
});
