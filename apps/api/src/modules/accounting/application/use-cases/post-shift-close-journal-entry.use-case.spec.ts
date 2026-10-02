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
import { PostShiftCloseJournalEntryUseCase } from "./post-shift-close-journal-entry.use-case";

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
    { companyId: "company-1", branchId: null, userId: "api:key-1", roles: [], permissions: new Set() },
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
  return { useCase: new PostShiftCloseJournalEntryUseCase(accountRepo, createEntry, postEntry), journalRepo };
}

function baseInput() {
  return {
    branchId: "branch-1",
    externalReference: "shift-1",
    date: new Date("2026-09-29"),
    payments: [] as { method: "CASH" | "CARD" | "TRANSFER" | "TRADE_IN" | "PLATFORM"; amount: number; platformName?: string }[],
    salesTaxBreakdown: [] as { taxType: "IVA" | "INC" | "EXEMPT"; taxRate: number; taxableBase: number; taxAmount: number }[],
    returns: [] as { taxType: "IVA" | "INC" | "EXEMPT"; taxableAmount: number; taxAmount: number; refundMethod: "CASH" | "CARD" | "TRANSFER" }[],
    expenses: [] as { amount: number; description: string }[],
    withdrawals: [] as { amount: number; description: string }[],
    advances: [] as { amount: number; method: "CASH" | "CARD" | "TRANSFER"; description?: string }[],
    cashExpected: 0,
    cashCounted: 0,
  };
}

function sumDebitCredit(lines: { debit: number; credit: number }[]) {
  return { debit: lines.reduce((s, l) => s + l.debit, 0), credit: lines.reduce((s, l) => s + l.credit, 0) };
}

describe("PostShiftCloseJournalEntryUseCase", () => {
  it("returns null and posts nothing when the shift has no money movement", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const entry = await withTenantContext(() => useCase.execute("close-1", baseInput()));
    expect(entry).toBeNull();
    expect(journalRepo.entries).toHaveLength(0);
  });

  it("posts one balanced entry for a simple cash sale (IVA 19%)", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      ...baseInput(),
      payments: [{ method: "CASH" as const, amount: 119_000 }],
      salesTaxBreakdown: [{ taxType: "IVA" as const, taxRate: 19, taxableBase: 100_000, taxAmount: 19_000 }],
      cashExpected: 119_000,
      cashCounted: 119_000,
    };

    const entry = await withTenantContext(() => useCase.execute("close-1", input));

    expect(entry?.status).toBe("POSTED");
    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 119_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-4135")).toMatchObject({ debit: 0, credit: 100_000 });
    expect(lines.find((l) => l.accountId === "acc-2408")).toMatchObject({ debit: 0, credit: 19_000 });
    const totals = sumDebitCredit(lines);
    expect(totals.debit).toBe(totals.credit);
    expect(journalRepo.entries[0].sourceType).toBe("ExternalShiftClose");
    expect(journalRepo.entries[0].sourceId).toBe("close-1");
    expect(journalRepo.entries[0].type).toBe("SHIFT_CLOSE");
  });

  it("nets a single line per account instead of emitting both debit and credit for the same account (regression: mixed cash sale + cash expense)", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      ...baseInput(),
      payments: [{ method: "CASH" as const, amount: 119_000 }],
      salesTaxBreakdown: [{ taxType: "IVA" as const, taxRate: 19, taxableBase: 100_000, taxAmount: 19_000 }],
      expenses: [{ amount: 30_000, description: "Domicilio de insumos" }],
      cashExpected: 89_000,
      cashCounted: 89_000,
    };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    const cajaLine = lines.find((l) => l.accountId === "acc-1105");
    // Neto: 119.000 (venta) - 30.000 (gasto) = 89.000, una sola linea, nunca debito Y credito juntos
    expect(cajaLine).toMatchObject({ debit: 89_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-5150")).toMatchObject({ debit: 30_000, credit: 0 });
    const totals = sumDebitCredit(lines);
    expect(totals.debit).toBe(totals.credit);
  });

  it("books trade-in equipment as an asset (not cash/bank)", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      ...baseInput(),
      payments: [{ method: "TRADE_IN" as const, amount: 50_000 }],
      salesTaxBreakdown: [{ taxType: "EXEMPT" as const, taxRate: 0, taxableBase: 50_000, taxAmount: 0 }],
    };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-143506")).toMatchObject({ debit: 50_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-4135")).toMatchObject({ debit: 0, credit: 50_000 });
  });

  it("books a platform order (Rappi) as a receivable from the platform, not cash", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      ...baseInput(),
      payments: [{ method: "PLATFORM" as const, amount: 35_700, platformName: "Rappi" }],
      salesTaxBreakdown: [{ taxType: "IVA" as const, taxRate: 19, taxableBase: 30_000, taxAmount: 5_700 }],
    };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-133595")).toMatchObject({ debit: 35_700, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1105")).toBeUndefined();
  });

  it("books an advance (apartado) as a liability, never as revenue", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = { ...baseInput(), advances: [{ amount: 40_000, method: "CASH" as const }], cashExpected: 40_000, cashCounted: 40_000 };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 40_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-2805")).toMatchObject({ debit: 0, credit: 40_000 });
    expect(lines.find((l) => l.accountId === "acc-4135")).toBeUndefined();
  });

  it("reverses revenue and IVA for a cash return, and pays it out of caja", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      ...baseInput(),
      returns: [{ taxType: "IVA" as const, taxableAmount: 10_000, taxAmount: 1_900, refundMethod: "CASH" as const }],
      cashExpected: -11_900,
      cashCounted: -11_900,
    };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-4175")).toMatchObject({ debit: 10_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-2408")).toMatchObject({ debit: 1_900, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 0, credit: 11_900 });
    const totals = sumDebitCredit(lines);
    expect(totals.debit).toBe(totals.credit);
  });

  it("books an owner withdrawal against caja", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = { ...baseInput(), withdrawals: [{ amount: 20_000, description: "Retiro personal" }], cashExpected: -20_000, cashCounted: -20_000 };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-3115")).toMatchObject({ debit: 20_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 0, credit: 20_000 });
  });

  it("books a cash shortage (faltante) as an expense", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = { ...baseInput(), cashExpected: 100_000, cashCounted: 97_000 };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-5195")).toMatchObject({ debit: 3_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 0, credit: 3_000 });
  });

  it("books a cash surplus (sobrante) as other income", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = { ...baseInput(), cashExpected: 100_000, cashCounted: 102_000 };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-4295")).toMatchObject({ debit: 0, credit: 2_000 });
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 2_000, credit: 0 });
  });

  it("throws (via CreateJournalEntryUseCase) when the POS sends inconsistent totals that do not balance", async () => {
    const { useCase } = makeUseCase();
    // payments = 119.000 pero salesTaxBreakdown solo suma 100.000 -- no cuadra.
    const input = {
      ...baseInput(),
      payments: [{ method: "CASH" as const, amount: 119_000 }],
      salesTaxBreakdown: [{ taxType: "EXEMPT" as const, taxRate: 0, taxableBase: 100_000, taxAmount: 0 }],
    };

    await expect(withTenantContext(() => useCase.execute("close-1", input))).rejects.toThrow(/no cuadra/);
  });

  it("combines every concept from a full shift into a single balanced entry", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      branchId: "branch-1",
      externalReference: "shift-full",
      date: new Date("2026-09-29"),
      payments: [
        { method: "CASH" as const, amount: 119_000 },
        { method: "CARD" as const, amount: 238_000 },
      ],
      salesTaxBreakdown: [{ taxType: "IVA" as const, taxRate: 19, taxableBase: 300_000, taxAmount: 57_000 }],
      returns: [{ taxType: "IVA" as const, taxableAmount: 5_000, taxAmount: 950, refundMethod: "CASH" as const }],
      expenses: [{ amount: 10_000, description: "Aseo" }],
      withdrawals: [{ amount: 15_000, description: "Retiro" }],
      advances: [{ amount: 20_000, method: "TRANSFER" as const }],
      cashExpected: 92_050,
      cashCounted: 92_000,
    };

    const entry = await withTenantContext(() => useCase.execute("close-1", input));

    expect(entry?.status).toBe("POSTED");
    const lines = journalRepo.entries[0].lines;
    const totals = sumDebitCredit(lines);
    expect(totals.debit).toBe(totals.credit);
    // Solo una linea de Caja y una de Bancos, no una por cada movimiento.
    expect(lines.filter((l) => l.accountId === "acc-1105")).toHaveLength(1);
    expect(lines.filter((l) => l.accountId === "acc-1110")).toHaveLength(1);
    expect(lines.find((l) => l.accountId === "acc-5195")).toMatchObject({ debit: 50, credit: 0 }); // faltante
  });
});
