import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type {
  CreateAccountData,
  AccountRecord,
  IChartOfAccountsRepository,
} from "../../domain/chart-of-accounts.repository";
import type { FinancialPeriodRecord, IFinancialPeriodRepository } from "../../domain/financial-period.repository";
import type {
  CreateJournalEntryData,
  IJournalEntryRepository,
  JournalEntryRecord,
} from "../../domain/journal-entry.repository";
import { CloseFinancialPeriodUseCase } from "./close-financial-period.use-case";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";

class FakeFinancialPeriodRepository implements IFinancialPeriodRepository {
  periods = new Map<string, FinancialPeriodRecord>();
  private key(year: number, month: number) {
    return `${year}-${month}`;
  }
  async list(year?: number): Promise<FinancialPeriodRecord[]> {
    return [...this.periods.values()].filter((p) => year === undefined || p.year === year);
  }
  async findClosed(year: number, month: number): Promise<FinancialPeriodRecord | null> {
    const p = this.periods.get(this.key(year, month));
    return p && p.status === "CLOSED" ? p : null;
  }
  async close(year: number, month: number): Promise<FinancialPeriodRecord> {
    const record: FinancialPeriodRecord = { id: `${year}-${month}`, year, month, status: "CLOSED", closedAt: new Date() };
    this.periods.set(this.key(year, month), record);
    return record;
  }
  async reopen(year: number, month: number): Promise<FinancialPeriodRecord> {
    const record: FinancialPeriodRecord = { id: `${year}-${month}`, year, month, status: "OPEN", closedAt: null };
    this.periods.set(this.key(year, month), record);
    return record;
  }
}

class FakeJournalEntryRepository implements IJournalEntryRepository {
  entries: JournalEntryRecord[] = [];
  draftMonthsWithEntries = new Set<string>();

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
  async hasDraftEntriesInPeriod(year: number, month: number): Promise<boolean> {
    return this.draftMonthsWithEntries.has(`${year}-${month}`);
  }
}

class FakeChartOfAccountsRepository implements IChartOfAccountsRepository {
  accounts: AccountRecord[] = [
    { id: "acc-1", code: "1105", name: "Caja", type: "ASSET", parentId: null, level: 1, isActive: true, acceptsEntries: true },
    { id: "acc-2", code: "4135", name: "Ingresos", type: "INCOME", parentId: null, level: 1, isActive: true, acceptsEntries: true },
  ];
  async create(data: CreateAccountData): Promise<AccountRecord> {
    const account: AccountRecord = { id: "acc-new", parentId: null, level: 1, isActive: true, acceptsEntries: true, ...data };
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
    return {
      id: `audit-${this.entries.length}`,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
      ...input,
    };
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

describe("CloseFinancialPeriodUseCase", () => {
  it("rejects closing a period that still has DRAFT journal entries", async () => {
    const periodRepo = new FakeFinancialPeriodRepository();
    const journalRepo = new FakeJournalEntryRepository();
    journalRepo.draftMonthsWithEntries.add("2026-7");
    const useCase = new CloseFinancialPeriodUseCase(periodRepo, journalRepo, new AuditService(new FakeAuditLogRepository()));

    await expect(withTenantContext(() => useCase.execute(2026, 7))).rejects.toThrow(/borrador/);
  });

  it("closes a period with no pending drafts and records an audit entry", async () => {
    const periodRepo = new FakeFinancialPeriodRepository();
    const journalRepo = new FakeJournalEntryRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new CloseFinancialPeriodUseCase(periodRepo, journalRepo, new AuditService(auditRepo));

    const result = await withTenantContext(() => useCase.execute(2026, 7));

    expect(result.status).toBe("CLOSED");
    expect(auditRepo.entries.some((e) => e.action === "FINANCIAL_PERIOD_CLOSED")).toBe(true);
  });
});

describe("CreateJournalEntryUseCase + closed period", () => {
  it("rejects a new entry dated inside a closed period", async () => {
    const periodRepo = new FakeFinancialPeriodRepository();
    await periodRepo.close(2026, 7);
    const journalRepo = new FakeJournalEntryRepository();
    const accountRepo = new FakeChartOfAccountsRepository();
    const useCase = new CreateJournalEntryUseCase(journalRepo, accountRepo, periodRepo, new AuditService(new FakeAuditLogRepository()));

    const input = {
      date: new Date("2026-07-15T00:00:00.000Z"),
      description: "Ajuste manual",
      type: "MANUAL",
      lines: [
        { accountId: "acc-1", debit: 1000, credit: 0 },
        { accountId: "acc-2", debit: 0, credit: 1000 },
      ],
    };

    await expect(withTenantContext(() => useCase.execute(input))).rejects.toThrow(/cerrado/);
  });

  it("allows a new entry dated outside the closed period", async () => {
    const periodRepo = new FakeFinancialPeriodRepository();
    await periodRepo.close(2026, 7);
    const journalRepo = new FakeJournalEntryRepository();
    const accountRepo = new FakeChartOfAccountsRepository();
    const useCase = new CreateJournalEntryUseCase(journalRepo, accountRepo, periodRepo, new AuditService(new FakeAuditLogRepository()));

    const input = {
      date: new Date("2026-08-01T00:00:00.000Z"),
      description: "Ajuste manual",
      type: "MANUAL",
      lines: [
        { accountId: "acc-1", debit: 1000, credit: 0 },
        { accountId: "acc-2", debit: 0, credit: 1000 },
      ],
    };

    const entry = await withTenantContext(() => useCase.execute(input));
    expect(entry.id).toBeDefined();
  });
});
