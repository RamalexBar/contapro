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
import { PostExpenseJournalEntryUseCase } from "./post-expense-journal-entry.use-case";

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
  return { useCase: new PostExpenseJournalEntryUseCase(accountRepo, createEntry, postEntry), journalRepo };
}

describe("PostExpenseJournalEntryUseCase", () => {
  it("does not post anything when the expense total is zero", async () => {
    const { useCase, journalRepo } = makeUseCase();

    const entry = await withTenantContext(() =>
      useCase.execute({
        expenseId: "expense-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        payeeName: "Arrendador X",
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        paymentMethod: "CASH",
        expenseAccountCode: "5120",
        expenseAccountName: "Arrendamientos",
      })
    );

    expect(entry).toBeNull();
    expect(journalRepo.entries).toHaveLength(0);
  });

  it("debits the category account and credits Caja for a CASH expense without IVA", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        expenseId: "expense-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        payeeName: "Arrendador X",
        subtotal: 500_000,
        taxTotal: 0,
        total: 500_000,
        paymentMethod: "CASH",
        expenseAccountCode: "5120",
        expenseAccountName: "Arrendamientos",
      })
    );

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-5120")).toMatchObject({ debit: 500_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 0, credit: 500_000 });
    expect(lines.find((l) => l.accountId === "acc-2408")).toBeUndefined();
  });

  it("debits IVA descontable and credits Bancos for a TRANSFER expense with IVA", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        expenseId: "expense-2",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        payeeName: "Contador externo",
        subtotal: 200_000,
        taxTotal: 38_000,
        total: 238_000,
        paymentMethod: "TRANSFER",
        expenseAccountCode: "5110",
        expenseAccountName: "Honorarios",
      })
    );

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-5110")).toMatchObject({ debit: 200_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-2408")).toMatchObject({ debit: 38_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1110")).toMatchObject({ debit: 0, credit: 238_000 });
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(238_000);
  });

  it("creates a distinct account per category code (does not reuse another category's account)", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(async () => {
      await useCase.execute({
        expenseId: "expense-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        payeeName: "Arrendador X",
        subtotal: 100_000,
        taxTotal: 0,
        total: 100_000,
        paymentMethod: "CASH",
        expenseAccountCode: "5120",
        expenseAccountName: "Arrendamientos",
      });
      await useCase.execute({
        expenseId: "expense-2",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        payeeName: "Empresa de energia",
        subtotal: 80_000,
        taxTotal: 0,
        total: 80_000,
        paymentMethod: "CASH",
        expenseAccountCode: "5135",
        expenseAccountName: "Servicios publicos",
      });
    });

    expect(journalRepo.entries[0].lines.find((l) => l.accountId === "acc-5120")).toBeDefined();
    expect(journalRepo.entries[1].lines.find((l) => l.accountId === "acc-5135")).toBeDefined();
  });
});

describe("PostExpenseJournalEntryUseCase — centro de costo (item 34 de docs/ALCANCE.md)", () => {
  it("tags the resulting JournalEntry with costCenterId without altering any account/amount", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        expenseId: "expense-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        payeeName: "Arrendador X",
        subtotal: 500_000,
        taxTotal: 0,
        total: 500_000,
        paymentMethod: "CASH",
        expenseAccountCode: "5120",
        expenseAccountName: "Arrendamientos",
        costCenterId: "cc-1",
      })
    );

    const entry = journalRepo.entries[0];
    expect(entry.costCenterId).toBe("cc-1");
    const lines = entry.lines;
    expect(lines.find((l) => l.accountId === "acc-5120")).toMatchObject({ debit: 500_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 0, credit: 500_000 });
  });

  it("leaves costCenterId null when omitted", async () => {
    const { useCase, journalRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        expenseId: "expense-1",
        branchId: "branch-1",
        date: new Date("2026-08-05"),
        payeeName: "Arrendador X",
        subtotal: 500_000,
        taxTotal: 0,
        total: 500_000,
        paymentMethod: "CASH",
        expenseAccountCode: "5120",
        expenseAccountName: "Arrendamientos",
      })
    );

    expect(journalRepo.entries[0].costCenterId).toBeNull();
  });
});
