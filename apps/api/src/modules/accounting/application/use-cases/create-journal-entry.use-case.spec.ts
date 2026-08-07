import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { AccountRecord, CreateAccountData, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { FinancialPeriodRecord, IFinancialPeriodRepository } from "../../domain/financial-period.repository";
import type { CostCenterRecord, ICostCenterRepository } from "../../domain/cost-center.repository";
import type { CreateJournalEntryData, IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";

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

const ACTIVE_COST_CENTER: CostCenterRecord = { id: "cc-1", code: "SUC-NORTE", name: "Sucursal Norte", isActive: true };
const INACTIVE_COST_CENTER: CostCenterRecord = { id: "cc-2", code: "SUC-SUR", name: "Sucursal Sur", isActive: false };

class FakeCostCenterRepository implements ICostCenterRepository {
  private costCenters = [ACTIVE_COST_CENTER, INACTIVE_COST_CENTER];
  async create(): Promise<CostCenterRecord> {
    throw new Error("not used in this spec");
  }
  async list(): Promise<CostCenterRecord[]> {
    return this.costCenters;
  }
  async findByIdOrThrow(id: string): Promise<CostCenterRecord> {
    const found = this.costCenters.find((c) => c.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
  async update(): Promise<CostCenterRecord> {
    throw new Error("not used in this spec");
  }
  async deactivate(): Promise<CostCenterRecord> {
    throw new Error("not used in this spec");
  }
}

class FakeJournalEntryRepository implements Partial<IJournalEntryRepository> {
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
}

class FakeChartOfAccountsRepository implements Partial<IChartOfAccountsRepository> {
  accounts: AccountRecord[] = [
    { id: "acc-1", code: "1105", name: "Caja", type: "ASSET", parentId: null, level: 1, isActive: true, acceptsEntries: true },
    { id: "acc-2", code: "4135", name: "Ingresos", type: "INCOME", parentId: null, level: 1, isActive: true, acceptsEntries: true },
  ];
  async create(data: CreateAccountData): Promise<AccountRecord> {
    const account: AccountRecord = { id: "acc-new", parentId: null, level: 1, isActive: true, acceptsEntries: true, ...data };
    this.accounts.push(account);
    return account;
  }
  async findByIdOrThrow(id: string): Promise<AccountRecord> {
    const account = this.accounts.find((a) => a.id === id);
    if (!account) throw new Error("not found");
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
  const journalRepo = new FakeJournalEntryRepository();
  const accountRepo = new FakeChartOfAccountsRepository();
  const costCenterRepo = new FakeCostCenterRepository();
  const useCase = new CreateJournalEntryUseCase(
    journalRepo as unknown as IJournalEntryRepository,
    accountRepo as unknown as IChartOfAccountsRepository,
    new FakeFinancialPeriodRepository(),
    costCenterRepo,
    new AuditService(new FakeAuditLogRepository())
  );
  return { useCase, journalRepo };
}

const BASE_INPUT = {
  date: new Date("2026-08-06"),
  description: "Ajuste manual",
  type: "MANUAL",
  lines: [
    { accountId: "acc-1", debit: 1000, credit: 0 },
    { accountId: "acc-2", debit: 0, credit: 1000 },
  ],
};

describe("CreateJournalEntryUseCase — centro de costo (item 34 de docs/ALCANCE.md)", () => {
  it("omitting costCenterId behaves as before this feature existed (regression)", async () => {
    const { useCase, journalRepo } = makeUseCase();

    const entry = await withTenantContext(() => useCase.execute(BASE_INPUT));

    expect(entry.costCenterId).toBeNull();
    expect(journalRepo.entries[0].costCenterId).toBeNull();
  });

  it("persists a valid, active cost center", async () => {
    const { useCase } = makeUseCase();

    const entry = await withTenantContext(() => useCase.execute({ ...BASE_INPUT, costCenterId: ACTIVE_COST_CENTER.id }));

    expect(entry.costCenterId).toBe(ACTIVE_COST_CENTER.id);
  });

  it("rejects an unknown cost center id", async () => {
    const { useCase } = makeUseCase();

    await expect(
      withTenantContext(() => useCase.execute({ ...BASE_INPUT, costCenterId: "does-not-exist" }))
    ).rejects.toThrow(/not found/);
  });

  it("rejects an inactive cost center", async () => {
    const { useCase } = makeUseCase();

    await expect(
      withTenantContext(() => useCase.execute({ ...BASE_INPUT, costCenterId: INACTIVE_COST_CENTER.id }))
    ).rejects.toThrow(/inactivo/);
  });
});
