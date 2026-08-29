import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { AccountRecord, CreateAccountData, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import { CreateAccountUseCase } from "./create-account.use-case";

class FakeChartOfAccountsRepository implements IChartOfAccountsRepository {
  accounts: AccountRecord[] = [
    { id: "acc-1105", code: "1105", name: "Caja general", type: "ASSET", parentId: null, level: 3, isActive: true, acceptsEntries: true },
    { id: "acc-1524", code: "1524", name: "Equipo de oficina", type: "ASSET", parentId: null, level: 3, isActive: false, acceptsEntries: true },
    { id: "acc-1110-sub", code: "111005", name: "Bancos - moneda nacional", type: "ASSET", parentId: null, level: 4, isActive: true, acceptsEntries: true },
    { id: "acc-off", code: "5140", name: "Legales", type: "EXPENSE", parentId: null, level: 3, isActive: false, acceptsEntries: false },
  ];
  async create(data: CreateAccountData): Promise<AccountRecord> {
    const account: AccountRecord = {
      id: `acc-new-${this.accounts.length}`,
      parentId: data.parentId ?? null,
      level: 5,
      isActive: true,
      acceptsEntries: data.acceptsEntries ?? true,
      ...data,
    };
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

function makeUseCase() {
  const accountRepo = new FakeChartOfAccountsRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new CreateAccountUseCase(accountRepo, new AuditService(auditRepo));
  return { useCase, accountRepo, auditRepo };
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

describe("CreateAccountUseCase — cuenta base deja de admitir movimientos al ganar una subcuenta/auxiliar", () => {
  it("does not touch anything when the new account has no parent", async () => {
    const { useCase, accountRepo, auditRepo } = makeUseCase();

    await withTenantContext(() => useCase.execute({ code: "9999", name: "Cuentas de orden", type: "ASSET" }));

    expect(accountRepo.accounts.find((a) => a.code === "1105")?.acceptsEntries).toBe(true);
    expect(auditRepo.entries.some((e) => e.action === "ACCOUNT_ENTRIES_DISABLED")).toBe(false);
  });

  it("disables direct entries on a level-3 (cuenta) parent that is not managed by the automatic engine", async () => {
    const { useCase, accountRepo, auditRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({ code: "152401", name: "Equipo de oficina - Computadores", type: "ASSET", parentId: "acc-1524" })
    );

    const parent = accountRepo.accounts.find((a) => a.id === "acc-1524");
    expect(parent?.acceptsEntries).toBe(false);
    expect(auditRepo.entries.some((e) => e.action === "ACCOUNT_ENTRIES_DISABLED" && e.entityId === "acc-1524")).toBe(true);
  });

  it("also disables a subcuenta/auxiliar (level >= 4) parent when it gains a child -- la regla es pareja para todos los niveles", async () => {
    const { useCase, accountRepo, auditRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({ code: "11100501", name: "Bancolombia cta 123", type: "ASSET", parentId: "acc-1110-sub" })
    );

    const parent = accountRepo.accounts.find((a) => a.id === "acc-1110-sub");
    expect(parent?.acceptsEntries).toBe(false);
    expect(auditRepo.entries.some((e) => e.action === "ACCOUNT_ENTRIES_DISABLED" && e.entityId === "acc-1110-sub")).toBe(true);
  });

  it("also disables a level-3 parent whose code es usado por el motor contable automatico -- Post*JournalEntryUseCase resuelve la subcuenta real via resolvePostingAccount", async () => {
    const { useCase, accountRepo, auditRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({ code: "110501", name: "Caja - sucursal norte", type: "ASSET", parentId: "acc-1105" })
    );

    const parent = accountRepo.accounts.find((a) => a.id === "acc-1105");
    expect(parent?.acceptsEntries).toBe(false);
    expect(auditRepo.entries.some((e) => e.action === "ACCOUNT_ENTRIES_DISABLED" && e.entityId === "acc-1105")).toBe(true);
  });

  it("is a no-op when the parent already does not accept direct entries", async () => {
    const { useCase, accountRepo, auditRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({ code: "514005", name: "Legales - notariales", type: "EXPENSE", parentId: "acc-off" })
    );

    const parent = accountRepo.accounts.find((a) => a.id === "acc-off");
    expect(parent?.acceptsEntries).toBe(false);
    expect(auditRepo.entries.some((e) => e.action === "ACCOUNT_ENTRIES_DISABLED")).toBe(false);
  });
});
