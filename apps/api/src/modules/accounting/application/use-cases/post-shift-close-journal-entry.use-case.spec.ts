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
    payments: [] as {
      method: "CASH" | "CARD" | "TRANSFER" | "TRADE_IN" | "PLATFORM" | "CREDIT" | "ADVANCE" | "COURIER" | "STORE_CREDIT";
      amount: number;
      platformName?: string;
    }[],
    salesTaxBreakdown: [] as {
      taxType: "IVA" | "INC" | "EXEMPT" | "EXCLUDED";
      taxRate: number;
      taxableBase: number;
      taxAmount: number;
    }[],
    returns: [] as {
      taxType: "IVA" | "INC" | "EXEMPT" | "EXCLUDED";
      taxableAmount: number;
      taxAmount: number;
      refundMethod: "CASH" | "CARD" | "TRANSFER" | "CREDIT" | "STORE_CREDIT";
    }[],
    expenses: [] as { amount: number; description: string; method: "CASH" | "CARD" | "TRANSFER" }[],
    withdrawals: [] as { amount: number; description: string }[],
    deposits: [] as { amount: number; description: string }[],
    advances: [] as { amount: number; method: "CASH" | "CARD" | "TRANSFER"; description?: string; kind?: "LAYAWAY" | "SERVICE" | "HOTEL" | "OTHER" }[],
    forfeitedAdvances: [] as { amount: number; description?: string }[],
    tipsReceived: [] as { method: "CASH" | "CARD" | "TRANSFER"; amount: number }[],
    tipsPaidOut: 0,
    thirdPartyIncome: [] as { concept: string; amount: number; commission: number }[],
    advancesRefunded: [] as { amount: number; method: "CASH" | "CARD" | "TRANSFER"; kind?: "LAYAWAY" | "SERVICE" | "HOTEL" | "OTHER" }[],
    debtCollections: [] as { amount: number; method: "CASH" | "CARD" | "TRANSFER" }[],
    courierMovements: [] as { type: "FLOAT_OUT" | "SETTLEMENT"; amount: number }[],
    thirdPartyPayments: [] as { concept: string; amount: number }[],
    openAccounts: { received: 0, applied: 0 },
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
      expenses: [{ amount: 30_000, description: "Domicilio de insumos", method: "CASH" as const }],
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

  it("books revenue with no tax line for an EXCLUDED sale, same as EXEMPT", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      ...baseInput(),
      payments: [{ method: "CASH" as const, amount: 15_000 }],
      salesTaxBreakdown: [{ taxType: "EXCLUDED" as const, taxRate: 0, taxableBase: 15_000, taxAmount: 0 }],
      cashExpected: 15_000,
      cashCounted: 15_000,
    };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-4135")).toMatchObject({ debit: 0, credit: 15_000 });
    expect(lines.find((l) => l.accountId === "acc-2408")).toBeUndefined();
    expect(lines.find((l) => l.accountId === "acc-240810")).toBeUndefined();
  });

  it("books a cash deposit as money moving from bancos into caja", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = { ...baseInput(), deposits: [{ amount: 50_000, description: "Reposicion de base" }] };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 50_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-1110")).toMatchObject({ debit: 0, credit: 50_000 });
  });

  it("books a forfeited advance as other income, reducing the liability", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = { ...baseInput(), forfeitedAdvances: [{ amount: 20_000, description: "Orden cancelada sin devolucion" }] };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-2805")).toMatchObject({ debit: 20_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-4295")).toMatchObject({ debit: 0, credit: 20_000 });
  });

  it("books tips received as a liability, not revenue, and nets what's paid out the same shift", async () => {
    const { useCase, journalRepo } = makeUseCase();
    const input = {
      ...baseInput(),
      tipsReceived: [{ method: "CASH" as const, amount: 8_000 }],
      tipsPaidOut: 5_000,
      cashExpected: 3_000,
      cashCounted: 3_000,
    };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    // Caja: +8.000 recibidas - 5.000 repartidas = 3.000 neto (una sola linea, neteada).
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 3_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-280510")).toMatchObject({ debit: 0, credit: 3_000 });
  });

  it("splits a third-party recharge between commission revenue and what's owed to the platform", async () => {
    const { useCase, journalRepo } = makeUseCase();
    // El efectivo de la recarga ya entra por `payments` (el POS lo cuenta como cobrado) --
    // `thirdPartyIncome` solo reparte ese ingreso entre comision real y lo que se debe al tercero.
    const input = {
      ...baseInput(),
      payments: [{ method: "CASH" as const, amount: 10_000 }],
      thirdPartyIncome: [{ concept: "Recargas Claro", amount: 10_000, commission: 500 }],
      cashExpected: 10_000,
      cashCounted: 10_000,
    };

    await withTenantContext(() => useCase.execute("close-1", input));

    const lines = journalRepo.entries[0].lines;
    expect(lines.find((l) => l.accountId === "acc-1105")).toMatchObject({ debit: 10_000, credit: 0 });
    expect(lines.find((l) => l.accountId === "acc-4210")).toMatchObject({ debit: 0, credit: 500 });
    expect(lines.find((l) => l.accountId === "acc-280515")).toMatchObject({ debit: 0, credit: 9_500 });
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
      ...baseInput(),
      branchId: "branch-1",
      externalReference: "shift-full",
      date: new Date("2026-09-29"),
      // CASH incluye 18.000 que en realidad son el ingreso de terceros (10.000) + la venta
      // EXCLUDED (8.000) -- en la vida real ese efectivo ya esta en `payments`, solo se reparte
      // entre las cuentas de ingreso/pasivo correctas aparte (ver pasos 6d y 2 del motor).
      payments: [
        { method: "CASH" as const, amount: 137_000 },
        { method: "CARD" as const, amount: 238_000 },
      ],
      salesTaxBreakdown: [
        { taxType: "IVA" as const, taxRate: 19, taxableBase: 300_000, taxAmount: 57_000 },
        { taxType: "EXCLUDED" as const, taxRate: 0, taxableBase: 8_000, taxAmount: 0 },
      ],
      returns: [{ taxType: "IVA" as const, taxableAmount: 5_000, taxAmount: 950, refundMethod: "CASH" as const }],
      expenses: [{ amount: 10_000, description: "Aseo", method: "CASH" as const }],
      withdrawals: [{ amount: 15_000, description: "Retiro" }],
      deposits: [{ amount: 5_000, description: "Reposicion de base" }],
      advances: [{ amount: 20_000, method: "TRANSFER" as const }],
      forfeitedAdvances: [{ amount: 3_000, description: "Apartado cancelado sin devolucion" }],
      tipsReceived: [{ method: "CASH" as const, amount: 2_000 }],
      tipsPaidOut: 1_000,
      thirdPartyIncome: [{ concept: "Recargas Movilway", amount: 10_000, commission: 500 }],
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
    expect(lines.find((l) => l.accountId === "acc-280510")).toMatchObject({ debit: 0, credit: 1_000 }); // propinas: 2.000 recibidas - 1.000 repartidas
    expect(lines.find((l) => l.accountId === "acc-4210")).toMatchObject({ debit: 0, credit: 500 }); // comision de recargas
    expect(lines.find((l) => l.accountId === "acc-280515")).toMatchObject({ debit: 0, credit: 9_500 }); // saldo a favor de la plataforma de recargas
  });
});

// Conceptos agregados 2026-10-13 para la conexion con Cajapro (fiado, anticipos usados, domiciliario,
// saldo a favor, abonos, cuentas abiertas). Cada caso verifica el asiento y que cuadre.
describe("PostShiftCloseJournalEntryUseCase -- conceptos de Cajapro", () => {
  const line = (lines: { accountId: string; debit: number; credit: number }[], code: string) => lines.find((l) => l.accountId === `acc-${code}`);

  async function post(overrides: Partial<ReturnType<typeof baseInput>>) {
    const { useCase, journalRepo } = makeUseCase();
    const entry = await withTenantContext(() => useCase.execute("close-1", { ...baseInput(), ...overrides }));
    const lines = journalRepo.entries[0].lines;
    const totals = sumDebitCredit(lines);
    expect(totals.debit).toBe(totals.credit);
    return { entry, lines };
  }

  it("venta fiada: debita Clientes en vez de Caja", async () => {
    const { lines } = await post({
      payments: [{ method: "CREDIT", amount: 119_000 }],
      salesTaxBreakdown: [{ taxType: "IVA", taxRate: 19, taxableBase: 100_000, taxAmount: 19_000 }],
    });
    expect(line(lines, "1305")).toMatchObject({ debit: 119_000, credit: 0 });
    expect(line(lines, "1105")).toBeUndefined();
  });

  it("venta pagada con anticipo (reserva de hotel) y con saldo a favor: baja Anticipos", async () => {
    const { lines } = await post({
      payments: [
        { method: "ADVANCE", amount: 80_000 },
        { method: "STORE_CREDIT", amount: 20_000 },
        { method: "CASH", amount: 8_000 },
      ],
      salesTaxBreakdown: [{ taxType: "INC", taxRate: 8, taxableBase: 100_000, taxAmount: 8_000 }],
      cashExpected: 8_000,
      cashCounted: 8_000,
    });
    expect(line(lines, "2805")).toMatchObject({ debit: 100_000, credit: 0 });
    expect(line(lines, "240810")).toMatchObject({ debit: 0, credit: 8_000 });
  });

  it("domiciliario: lo que cobro queda por legalizar; la base sale y vuelve con la liquidacion", async () => {
    const { lines } = await post({
      payments: [{ method: "COURIER", amount: 50_000 }],
      salesTaxBreakdown: [{ taxType: "EXEMPT", taxRate: 0, taxableBase: 50_000, taxAmount: 0 }],
      courierMovements: [
        { type: "FLOAT_OUT", amount: 20_000 },
        { type: "SETTLEMENT", amount: 70_000 },
      ],
      cashExpected: 50_000,
      cashCounted: 50_000,
    });
    // 50.000 cobrados + 20.000 de base - 70.000 entregados = queda en cero por legalizar
    expect(line(lines, "138095")).toBeUndefined();
    expect(line(lines, "1105")).toMatchObject({ debit: 50_000, credit: 0 });
  });

  it("abono de fiado cobrado en la caja", async () => {
    const { lines } = await post({
      debtCollections: [{ amount: 30_000, method: "CASH" }],
      cashExpected: 30_000,
      cashCounted: 30_000,
    });
    expect(line(lines, "1305")).toMatchObject({ debit: 0, credit: 30_000 });
    expect(line(lines, "1105")).toMatchObject({ debit: 30_000, credit: 0 });
  });

  it("anticipo de hotel recibido y otro devuelto al cancelar", async () => {
    const { lines } = await post({
      advances: [{ amount: 100_000, method: "TRANSFER", kind: "HOTEL" }],
      advancesRefunded: [{ amount: 40_000, method: "CASH", kind: "HOTEL" }],
      deposits: [{ amount: 40_000, description: "Base" }],
      cashExpected: 0,
      cashCounted: 0,
    });
    expect(line(lines, "2805")).toMatchObject({ debit: 0, credit: 60_000 });
  });

  it("devolucion que baja la deuda del cliente y otra que queda como saldo a favor", async () => {
    const { lines } = await post({
      returns: [
        { taxType: "IVA", taxableAmount: 10_000, taxAmount: 1_900, refundMethod: "CREDIT" },
        { taxType: "IVA", taxableAmount: 5_000, taxAmount: 950, refundMethod: "STORE_CREDIT" },
      ],
    });
    expect(line(lines, "1305")).toMatchObject({ debit: 0, credit: 11_900 });
    expect(line(lines, "2805")).toMatchObject({ debit: 0, credit: 5_950 });
    expect(line(lines, "4175")).toMatchObject({ debit: 15_000, credit: 0 });
  });

  it("gasto pagado con transferencia sale de Bancos, no de Caja", async () => {
    const { lines } = await post({ expenses: [{ amount: 25_000, description: "Gas", method: "TRANSFER" }] });
    expect(line(lines, "1110")).toMatchObject({ debit: 0, credit: 25_000 });
    expect(line(lines, "1105")).toBeUndefined();
  });

  it("cargar saldo de recargas baja lo que se le debe al tercero", async () => {
    const { lines } = await post({
      thirdPartyPayments: [{ concept: "Saldo Movilway", amount: 100_000 }],
      deposits: [{ amount: 100_000, description: "Base" }],
    });
    expect(line(lines, "280515")).toMatchObject({ debit: 100_000, credit: 0 });
  });

  it("cuenta abierta pagada por partes: lo de hoy es anticipo, lo de antes se aplica al cerrarla", async () => {
    // Hoy: se cobraron 30.000 de una mesa que sigue abierta, y se cerro otra de 119.000 que ya tenia 50.000 de ayer
    const { lines } = await post({
      payments: [{ method: "CASH", amount: 99_000 }],
      salesTaxBreakdown: [{ taxType: "IVA", taxRate: 19, taxableBase: 100_000, taxAmount: 19_000 }],
      openAccounts: { received: 30_000, applied: 50_000 },
      cashExpected: 99_000,
      cashCounted: 99_000,
    });
    expect(line(lines, "2805")).toMatchObject({ debit: 20_000, credit: 0 });
    expect(line(lines, "4135")).toMatchObject({ debit: 0, credit: 100_000 });
  });
});
