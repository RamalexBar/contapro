import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { FixedAssetRecord, IFixedAssetRepository } from "../../domain/fixed-asset.repository";
import type {
  DepreciationEntryRecord,
  IDepreciationEntryRepository,
  UpsertDepreciationEntryForPeriodData,
} from "../../domain/depreciation-entry.repository";
import { CalculateDepreciationUseCase } from "./calculate-depreciation.use-case";

function makeAsset(overrides: Partial<FixedAssetRecord>): FixedAssetRecord {
  return {
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
    ...overrides,
  };
}

class FakeFixedAssetRepository implements Partial<IFixedAssetRepository> {
  constructor(private readonly assets: FixedAssetRecord[]) {}
  async listActive(): Promise<FixedAssetRecord[]> {
    return this.assets.filter((a) => a.isActive);
  }
}

class FakeDepreciationEntryRepository implements Partial<IDepreciationEntryRepository> {
  upserted: UpsertDepreciationEntryForPeriodData[] = [];
  postedAssets = new Set<string>();

  async upsertForPeriod(data: UpsertDepreciationEntryForPeriodData): Promise<DepreciationEntryRecord | null> {
    this.upserted.push(data);
    if (this.postedAssets.has(data.fixedAssetId)) return null;
    return {
      id: `entry-${data.fixedAssetId}`,
      fixedAssetId: data.fixedAssetId,
      year: data.year,
      month: data.month,
      amount: data.amount,
      status: "CALCULATED",
      calculatedAt: new Date(),
      postedAt: null,
      journalEntryId: null,
    };
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

function makeUseCase(assets: FixedAssetRecord[]) {
  const fixedAssetRepo = new FakeFixedAssetRepository(assets);
  const entryRepo = new FakeDepreciationEntryRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new CalculateDepreciationUseCase(
    fixedAssetRepo as unknown as IFixedAssetRepository,
    entryRepo as unknown as IDepreciationEntryRepository,
    new AuditService(auditRepo)
  );
  return { useCase, entryRepo };
}

describe("CalculateDepreciationUseCase", () => {
  it("computes the straight-line monthly quota for an eligible asset", async () => {
    const asset = makeAsset({ id: "asset-1", cost: 12_000_000, salvageValue: 0, usefulLifeMonths: 24 });
    const { useCase } = makeUseCase([asset]);

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toEqual([expect.objectContaining({ fixedAssetId: "asset-1", amount: 500_000 })]);
  });

  it("caps the last period's amount so it never exceeds the depreciable base", async () => {
    // cuota = 1_200_000/12 = 100_000, pero solo quedan 50_000 de base depreciable
    const asset = makeAsset({ id: "asset-4", cost: 1_200_000, salvageValue: 0, usefulLifeMonths: 12, accumulatedDepreciation: 1_150_000 });
    const { useCase } = makeUseCase([asset]);

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toEqual([expect.objectContaining({ fixedAssetId: "asset-4", amount: 50_000 })]);
  });

  it("excludes assets purchased after the period", async () => {
    const asset = makeAsset({ id: "asset-future", purchaseDate: new Date(2026, 6, 15) });
    const { useCase, entryRepo } = makeUseCase([asset]);

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toHaveLength(0);
    expect(entryRepo.upserted).toHaveLength(0);
  });

  it("excludes assets that are already fully depreciated", async () => {
    const asset = makeAsset({ id: "asset-done", cost: 1_000_000, salvageValue: 0, usefulLifeMonths: 10, accumulatedDepreciation: 1_000_000 });
    const { useCase, entryRepo } = makeUseCase([asset]);

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toHaveLength(0);
    expect(entryRepo.upserted).toHaveLength(0);
  });

  it("does not overwrite an already POSTED entry", async () => {
    const asset = makeAsset({ id: "asset-1" });
    const { useCase, entryRepo } = makeUseCase([asset]);
    entryRepo.postedAssets.add("asset-1");

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toHaveLength(0);
    expect(entryRepo.upserted).toHaveLength(1);
  });
});
