import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { AccountRecord, CreateAccountData, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { FinancialPeriodRecord, IFinancialPeriodRepository } from "../../domain/financial-period.repository";
import type { CostCenterRecord, ICostCenterRepository } from "../../domain/cost-center.repository";
import type { CreateJournalEntryData, IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";
import { PostPurchaseJournalEntryUseCase } from "./post-purchase-journal-entry.use-case";

class FakeFinancialPeriodRepository implements IFinancialPeriodRepository {
  async list(): Promise<FinancialPeriodRecord[]> {
    return [];
  }
  async findClosed(): Promise<FinancialPeriodRecord | null> {
    return null;
  }
  close(): Promise<FinancialPeriodRecord> {
    throw new Error("not used in this spec");
  }
  reopen(): Promise<FinancialPeriodRecord> {
    throw new Error("not used in this spec");
  }
}

class FakeCostCenterRepository implements ICostCenterRepository {
  create(): Promise<CostCenterRecord> {
    throw new Error("not used in this spec");
  }
  list(): Promise<CostCenterRecord[]> {
    throw new Error("not used in this spec");
  }
  findByIdOrThrow(): Promise<CostCenterRecord> {
    throw new Error("not used in this spec");
  }
  update(): Promise<CostCenterRecord> {
    throw new Error("not used in this spec");
  }
  deactivate(): Promise<CostCenterRecord> {
    throw new Error("not used in this spec");
  }
}

class FakeJournalEntryRepository implements IJournalEntryRepository {
  entries: JournalEntryRecord[] = [];

  async create(data: CreateJournalEntryData): Promise<JournalEntryRecord> {
    const entry: JournalEntryRecord = {
      id: `entry-${this.entries.length + 1}`,
      number: this.entries.length + 1,
      date: data.date,
      description: data.description,
      type: data.type,
      sourceType: data.sourceType ?? null,
      sourceId: data.sourceId ?? null,
      status: "DRAFT",
      createdByUserId: data.createdByUserId,
      postedAt: null,
      costCenterId: data.costCenterId ?? null,
      lines: data.lines.map((l, i) => ({ id: `line-${i}`, accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description ?? null })),
    };
    this.entries.push(entry);
    return entry;
  }
  async list(): Promise<JournalEntryRecord[]> {
    return this.entries;
  }
  async findByIdOrThrow(id: string): Promise<JournalEntryRecord> {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new Error("not found");
    return entry;
  }
  async updateStatus(id: string, status: string): Promise<JournalEntryRecord> {
    const entry = await this.findByIdOrThrow(id);
    entry.status = status;
    return entry;
  }
  async listPostedLines() {
    return [];
  }
  async hasDraftEntriesInPeriod(): Promise<boolean> {
    return false;
  }
  async findBySource(sourceType: string, sourceId: string): Promise<JournalEntryRecord | null> {
    return this.entries.find((e) => e.sourceType === sourceType && e.sourceId === sourceId) ?? null;
  }
}

class FakeChartOfAccountsRepository implements IChartOfAccountsRepository {
  accounts: AccountRecord[] = [];
  async create(data: CreateAccountData): Promise<AccountRecord> {
    const account: AccountRecord = { id: `acc-${data.code}`, parentId: null, level: 1, isActive: true, acceptsEntries: true, ...data };
    this.accounts.push(account);
    return account;
  }
  async list(): Promise<AccountRecord[]> {
    return this.accounts;
  }
  async findByCode(code: string): Promise<AccountRecord | null> {
    return this.accounts.find((a) => a.code === code) ?? null;
  }
  async findByIdOrThrow(id: string): Promise<AccountRecord> {
    const account = this.accounts.find((a) => a.id === id);
    if (!account) throw new Error("not found");
    return account;
  }
  async upsertByCode(data: CreateAccountData): Promise<AccountRecord> {
    return (await this.findByCode(data.code)) ?? this.create(data);
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

function makeUseCase() {
  const accountRepo = new FakeChartOfAccountsRepository();
  const journalRepo = new FakeJournalEntryRepository();
  const auditService = new AuditService(new FakeAuditLogRepository());
  const createEntry = new CreateJournalEntryUseCase(
    journalRepo,
    accountRepo,
    new FakeFinancialPeriodRepository(),
    new FakeCostCenterRepository(),
    auditService
  );
  const postEntry = new PostJournalEntryUseCase(journalRepo, auditService);
  return { useCase: new PostPurchaseJournalEntryUseCase(accountRepo, createEntry, postEntry), journalRepo };
}

const NO_WITHHOLDINGS = { RETEFUENTE: 0, RETEICA: 0, RETEIVA: 0 } as const;

describe("PostPurchaseJournalEntryUseCase", () => {
  it("does not post anything when the purchase total is zero", async () => {
    const { useCase, journalRepo } = makeUseCase();

    const entry = await withTenantContext(() =>
      useCase.execute({
        purchaseId: "purchase-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        invoiceNumber: "F-1",
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        retentionTotal: 0,
        withholdingsByType: NO_WITHHOLDINGS,
      })
    );

    expect(entry).toBeNull();
    expect(journalRepo.entries).toHaveLength(0);
  });

  it("credits Proveedores by the full total when there is no retention (baseline)", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        purchaseId: "purchase-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        invoiceNumber: "F-1",
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        retentionTotal: 0,
        withholdingsByType: NO_WITHHOLDINGS,
      })
    );

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-1435")).toMatchObject({ debit: 100_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-2408")).toMatchObject({ debit: 19_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-2205")).toMatchObject({ debit: 0, credit: 119_000 });
    expect(lines.some((l) => l.accountId.startsWith("acc-2365") || l.accountId.startsWith("acc-2368") || l.accountId.startsWith("acc-2367"))).toBe(false);
  });

  it("credits the retention-liability account and reduces the Proveedores credit by the retained amount", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        purchaseId: "purchase-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        invoiceNumber: "F-1",
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        retentionTotal: 4_000,
        withholdingsByType: { RETEFUENTE: 2_500, RETEICA: 1_500, RETEIVA: 0 },
      })
    );

    const lines = journalRepo.entries[0].lines;
    // proveedores neto = 119000 - 4000
    expect(lines.find((l) => l.accountId === "acc-2205")).toMatchObject({ debit: 0, credit: 115_000 });
    expect(lines.find((l) => l.accountId === "acc-236540")).toMatchObject({ debit: 0, credit: 2_500 });
    expect(lines.find((l) => l.accountId === "acc-236801")).toMatchObject({ debit: 0, credit: 1_500 });
    expect(lines.find((l) => l.accountId === "acc-236705")).toBeUndefined();
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalCredit).toBe(119_000);
  });
});

describe("PostPurchaseJournalEntryUseCase — multi-moneda informativa (item 33 de docs/ALCANCE.md)", () => {
  it("keeps the plain description when currency is omitted or COP", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        purchaseId: "purchase-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        invoiceNumber: "F-1",
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        retentionTotal: 0,
        withholdingsByType: NO_WITHHOLDINGS,
      })
    );

    expect(journalRepo.entries[0].description).toBe("Compra factura F-1");
  });

  it("annotates the description with the foreign currency and TRM, leaving debit/credit amounts in COP", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        purchaseId: "purchase-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        invoiceNumber: "F-1",
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        retentionTotal: 0,
        withholdingsByType: NO_WITHHOLDINGS,
        currency: "USD",
        exchangeRate: 4200,
      })
    );

    const entry = journalRepo.entries[0];
    expect(entry.description).toBe("Compra factura F-1 (USD 28.33 @ TRM 4200)");
    const lines = entry.lines;
    expect(lines.find((l) => l.accountId === "acc-1435")).toMatchObject({ debit: 100_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-2205")).toMatchObject({ debit: 0, credit: 119_000 });
  });
});
