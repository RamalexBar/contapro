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
import { PostReturnJournalEntryUseCase } from "./post-return-journal-entry.use-case";

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
  async setActive(id: string, isActive: boolean): Promise<AccountRecord> {
    const account = await this.findByIdOrThrow(id);
    account.isActive = isActive;
    return account;
  }
  async disableDirectEntries(id: string): Promise<AccountRecord> {
    const account = await this.findByIdOrThrow(id);
    account.acceptsEntries = false;
    return account;
  }
  async update(id: string, data: { name: string }): Promise<AccountRecord> {
    const account = await this.findByIdOrThrow(id);
    account.name = data.name;
    return account;
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
  return { useCase: new PostReturnJournalEntryUseCase(accountRepo, createEntry, postEntry), journalRepo, accountRepo };
}

describe("PostReturnJournalEntryUseCase", () => {
  it("does not post anything when the return total is zero", async () => {
    const { useCase, journalRepo } = makeUseCase();

    const entry = await withTenantContext(() =>
      useCase.execute({ returnId: "return-1", branchId: "branch-1", date: new Date("2026-08-02"), subtotal: 0, taxTotal: 0, total: 0, refundMethod: "CASH" })
    );

    expect(entry).toBeNull();
    expect(journalRepo.entries).toHaveLength(0);
  });

  it("credits Caja when the refund method is CASH", async () => {
    const { useCase, journalRepo } = makeUseCase();

    const entry = await withTenantContext(() =>
      useCase.execute({
        returnId: "return-1",
        branchId: "branch-1",
        date: new Date("2026-08-02"),
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        refundMethod: "CASH",
      })
    );

    expect(entry?.status).toBe("POSTED");
    const cajaLine = journalRepo.entries[0].lines.find((l) => l.accountId === "acc-1105");
    expect(cajaLine).toMatchObject({ debit: 0, credit: 119_000 });
    const ingresosLine = journalRepo.entries[0].lines.find((l) => l.accountId === "acc-4135");
    expect(ingresosLine).toMatchObject({ debit: 100_000, credit: 0 });
    const ivaLine = journalRepo.entries[0].lines.find((l) => l.accountId === "acc-2408");
    expect(ivaLine).toMatchObject({ debit: 19_000, credit: 0 });
  });

  it("credits Bancos when the refund method is CARD or TRANSFER", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        returnId: "return-1",
        branchId: "branch-1",
        date: new Date("2026-08-02"),
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        refundMethod: "TRANSFER",
      })
    );

    const bancosLine = journalRepo.entries[0].lines.find((l) => l.accountId === "acc-1110");
    expect(bancosLine).toMatchObject({ debit: 0, credit: 119_000 });
  });

  it("adds the cost-of-goods-sold reversal (debit 1435, credit 6135) when costOfGoodsSold is provided", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        returnId: "return-1",
        branchId: "branch-1",
        date: new Date("2026-08-02"),
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        refundMethod: "CASH",
        costOfGoodsSold: 30_000,
      })
    );

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-1435")).toMatchObject({ debit: 30_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-6135")).toMatchObject({ debit: 0, credit: 30_000 });
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("omits the cost-of-goods-sold lines when costOfGoodsSold is not provided (backward compatible)", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        returnId: "return-1",
        branchId: "branch-1",
        date: new Date("2026-08-02"),
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        refundMethod: "CASH",
      })
    );

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-1435")).toBeUndefined();
    expect(lines.find((l) => l.accountId === "acc-6135")).toBeUndefined();
  });

  it("credits Clientes when the refund method is CREDIT_TO_ACCOUNT", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        returnId: "return-1",
        branchId: "branch-1",
        date: new Date("2026-08-02"),
        subtotal: 100_000,
        taxTotal: 19_000,
        total: 119_000,
        refundMethod: "CREDIT_TO_ACCOUNT",
      })
    );

    const clientesLine = journalRepo.entries[0].lines.find((l) => l.accountId === "acc-1305");
    expect(clientesLine).toMatchObject({ debit: 0, credit: 119_000 });
  });
});
