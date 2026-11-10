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
import { PostInventoryJournalEntryUseCase } from "./post-inventory-journal-entry.use-case";

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
  async findByIdOrThrow(id: string): Promise<CostCenterRecord> {
    return { id, code: "SUC-NORTE", name: "Sucursal Norte", isActive: true };
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
  async resolvePostingAccount(data: CreateAccountData): Promise<AccountRecord> {
    let current = await this.upsertByCode(data);
    for (;;) {
      const children = this.accounts.filter((a) => a.parentId === current.id);
      if (children.length !== 1) return current;
      current = children[0];
    }
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
  async enableDirectEntries(id: string): Promise<AccountRecord> {
    const account = await this.findByIdOrThrow(id);
    account.acceptsEntries = true;
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
  return { useCase: new PostInventoryJournalEntryUseCase(accountRepo, createEntry, postEntry), journalRepo };
}

const base = { date: new Date("2026-11-10T15:00:00Z"), branchId: "branch-1", sourceType: "StockMovement", sourceId: "mov-1", description: "x" };

function linesOf(entry: JournalEntryRecord) {
  return entry.lines.map((l) => [l.accountId, l.debit, l.credit]);
}

describe("PostInventoryJournalEntryUseCase", () => {
  it("existencias iniciales y entradas manuales: Debito 1435 / Credito 3115 Aportes", async () => {
    const { useCase, journalRepo } = makeUseCase();
    await withTenantContext(() => useCase.execute({ ...base, kind: "OPENING", amount: 2500 }));
    await withTenantContext(() => useCase.execute({ ...base, kind: "ENTRY", amount: 3000 }));
    expect(journalRepo.entries.map(linesOf)).toEqual([
      [["acc-1435", 2500, 0], ["acc-3115", 0, 2500]],
      [["acc-1435", 3000, 0], ["acc-3115", 0, 3000]],
    ]);
    expect(journalRepo.entries.every((e) => e.status === "POSTED")).toBe(true);
  });

  it("sobrante contra 4295 y faltante contra 5195", async () => {
    const { useCase, journalRepo } = makeUseCase();
    await withTenantContext(() => useCase.execute({ ...base, kind: "SURPLUS", amount: 600 }));
    await withTenantContext(() => useCase.execute({ ...base, kind: "SHORTAGE", amount: 516.67 }));
    expect(journalRepo.entries.map(linesOf)).toEqual([
      [["acc-1435", 600, 0], ["acc-4295", 0, 600]],
      [["acc-1435", 0, 516.67], ["acc-5195", 516.67, 0]],
    ]);
  });

  it("regularizacion con signo: sube o baja la 1435 contra 3115", async () => {
    const { useCase, journalRepo } = makeUseCase();
    await withTenantContext(() => useCase.execute({ ...base, kind: "REGULARIZATION", amount: 4305783.4 }));
    await withTenantContext(() => useCase.execute({ ...base, kind: "REGULARIZATION", amount: -100 }));
    expect(journalRepo.entries.map(linesOf)).toEqual([
      [["acc-1435", 4305783.4, 0], ["acc-3115", 0, 4305783.4]],
      [["acc-1435", 0, 100], ["acc-3115", 100, 0]],
    ]);
  });

  it("no contabiliza montos en cero", async () => {
    const { useCase, journalRepo } = makeUseCase();
    expect(await withTenantContext(() => useCase.execute({ ...base, kind: "ENTRY", amount: 0.001 }))).toBeNull();
    expect(journalRepo.entries).toHaveLength(0);
  });
});
