import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { AccountRecord, CreateAccountData, IChartOfAccountsRepository, UpdateAccountData } from "../../domain/chart-of-accounts.repository";
import { UpdateAccountUseCase } from "./update-account.use-case";

class FakeChartOfAccountsRepository implements IChartOfAccountsRepository {
  accounts: AccountRecord[] = [
    { id: "acc-clase", code: "1", name: "Activo", type: "ASSET", parentId: null, level: 1, isActive: true, acceptsEntries: false },
    { id: "acc-grupo", code: "15", name: "Propiedades, planta y equipo", type: "ASSET", parentId: "acc-clase", level: 2, isActive: true, acceptsEntries: false },
    { id: "acc-cuenta", code: "1524", name: "Equipo de oficina", type: "ASSET", parentId: "acc-grupo", level: 3, isActive: false, acceptsEntries: true },
    { id: "acc-subcuenta", code: "152401", name: "Equipo de oficina - Computadores", type: "ASSET", parentId: "acc-cuenta", level: 4, isActive: true, acceptsEntries: true },
    { id: "acc-auxiliar", code: "15240101", name: "Computador gerencia", type: "ASSET", parentId: "acc-subcuenta", level: 5, isActive: true, acceptsEntries: true },
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
  async update(id: string, data: UpdateAccountData): Promise<AccountRecord> {
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
  const useCase = new UpdateAccountUseCase(accountRepo, new AuditService(auditRepo));
  return { useCase, accountRepo, auditRepo };
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

describe("UpdateAccountUseCase — solo subcuentas y auxiliares se pueden editar", () => {
  it("renames a subcuenta (level 4)", async () => {
    const { useCase, accountRepo, auditRepo } = makeUseCase();

    const updated = await withTenantContext(() => useCase.execute("acc-subcuenta", { name: "Equipo de oficina - Portatiles" }));

    expect(updated.name).toBe("Equipo de oficina - Portatiles");
    expect(accountRepo.accounts.find((a) => a.id === "acc-subcuenta")?.name).toBe("Equipo de oficina - Portatiles");
    expect(auditRepo.entries.some((e) => e.action === "ACCOUNT_UPDATED" && e.entityId === "acc-subcuenta")).toBe(true);
  });

  it("renames an auxiliar (level 5)", async () => {
    const { useCase, accountRepo } = makeUseCase();

    await withTenantContext(() => useCase.execute("acc-auxiliar", { name: "Computador contabilidad" }));

    expect(accountRepo.accounts.find((a) => a.id === "acc-auxiliar")?.name).toBe("Computador contabilidad");
  });

  it("rejects renaming a cuenta (level 3, cuenta principal)", async () => {
    const { useCase, accountRepo, auditRepo } = makeUseCase();

    await expect(withTenantContext(() => useCase.execute("acc-cuenta", { name: "Otro nombre" }))).rejects.toThrow(/cuenta principal/);

    expect(accountRepo.accounts.find((a) => a.id === "acc-cuenta")?.name).toBe("Equipo de oficina");
    expect(auditRepo.entries.some((e) => e.action === "ACCOUNT_UPDATED")).toBe(false);
  });

  it("rejects renaming a grupo (level 2)", async () => {
    const { useCase } = makeUseCase();

    await expect(withTenantContext(() => useCase.execute("acc-grupo", { name: "Otro nombre" }))).rejects.toThrow(/cuenta principal/);
  });

  it("rejects renaming a clase (level 1)", async () => {
    const { useCase } = makeUseCase();

    await expect(withTenantContext(() => useCase.execute("acc-clase", { name: "Otro nombre" }))).rejects.toThrow(/cuenta principal/);
  });
});
