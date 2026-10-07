import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { AccountRecord, CreateAccountData, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import { CreateAccountUseCase } from "./create-account.use-case";
import { ImportChartOfAccountsUseCase } from "./import-chart-of-accounts.use-case";
import { SetAccountActiveUseCase } from "./set-account-active.use-case";
import { UpdateAccountUseCase } from "./update-account.use-case";

/** Recorte del PUC precargado: clases/grupos activos, 1105 activa, 1120 inactiva, 110505 subcuenta. */
class FakeChartOfAccountsRepository implements IChartOfAccountsRepository {
  accounts: AccountRecord[] = [
    acc("1", "Activo", "ASSET", null, 1, true, false),
    acc("11", "Disponible", "ASSET", "1", 2, true, false),
    acc("1105", "Caja general", "ASSET", "11", 3, true, true),
    acc("1120", "Cuentas de ahorro", "ASSET", "11", 3, false, true),
    acc("4", "Ingresos", "INCOME", null, 1, true, false),
    acc("41", "Operacionales", "INCOME", "4", 2, true, false),
    acc("4135", "Comercio al por mayor y al por menor", "INCOME", "41", 3, true, true),
    acc("413505", "Venta de mercancias", "INCOME", "4135", 4, false, true),
  ];

  async create(data: CreateAccountData): Promise<AccountRecord> {
    if (this.accounts.some((a) => a.code === data.code)) throw new Error(`Ya existe una cuenta con el codigo ${data.code}`);
    const parent = data.parentId ? await this.findByIdOrThrow(data.parentId) : null;
    const account: AccountRecord = {
      id: `acc-${data.code}`,
      code: data.code,
      name: data.name,
      type: data.type,
      parentId: data.parentId ?? null,
      level: parent ? parent.level + 1 : 1,
      isActive: true,
      acceptsEntries: data.acceptsEntries ?? true,
    };
    this.accounts.push(account);
    return account;
  }
  async list(): Promise<AccountRecord[]> {
    return [...this.accounts];
  }
  async findByCode(code: string): Promise<AccountRecord | null> {
    return this.accounts.find((a) => a.code === code) ?? null;
  }
  async findByIdOrThrow(id: string): Promise<AccountRecord> {
    const account = this.accounts.find((a) => a.id === id);
    if (!account) throw new Error("not found");
    return account;
  }
  async upsertByCode(): Promise<AccountRecord> {
    throw new Error("not used");
  }
  async resolvePostingAccount(): Promise<AccountRecord> {
    throw new Error("not used");
  }
  async setActive(id: string, isActive: boolean): Promise<AccountRecord> {
    return this.patch(id, { isActive });
  }
  async disableDirectEntries(id: string): Promise<AccountRecord> {
    return this.patch(id, { acceptsEntries: false });
  }
  async enableDirectEntries(id: string): Promise<AccountRecord> {
    return this.patch(id, { acceptsEntries: true });
  }
  async update(id: string, data: { name: string }): Promise<AccountRecord> {
    return this.patch(id, data);
  }
  byCode(code: string) {
    return this.accounts.find((a) => a.code === code);
  }
  private async patch(id: string, data: Partial<AccountRecord>) {
    const account = await this.findByIdOrThrow(id);
    Object.assign(account, data);
    return account;
  }
}

function acc(code: string, name: string, type: AccountRecord["type"], parentCode: string | null, level: number, isActive: boolean, acceptsEntries: boolean): AccountRecord {
  return { id: `acc-${code}`, code, name, type, parentId: parentCode ? `acc-${parentCode}` : null, level, isActive, acceptsEntries };
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
  const repo = new FakeChartOfAccountsRepository();
  const audit = new AuditService(new FakeAuditLogRepository());
  const useCase = new ImportChartOfAccountsUseCase(
    repo,
    new CreateAccountUseCase(repo, audit),
    new UpdateAccountUseCase(repo, audit),
    new SetAccountActiveUseCase(repo, audit)
  );
  return { useCase, repo };
}

function run<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() }, fn);
}

describe("ImportChartOfAccountsUseCase", () => {
  it("crea las cuentas nuevas debajo de su padre por prefijo, incluso si el padre tambien es nuevo", async () => {
    const { useCase, repo } = makeUseCase();
    const result = await run(() =>
      useCase.execute({
        rows: [
          { code: "11050501", name: "Caja menor oficina" },
          { code: "110505", name: "Caja principal" },
          { code: "1", name: "Activo" },
        ],
        dryRun: false,
      })
    );

    expect(result).toMatchObject({ created: 2, activated: 0, unchanged: 1, errors: [] });
    expect(repo.byCode("110505")).toMatchObject({ parentId: "acc-1105", level: 4, type: "ASSET" });
    expect(repo.byCode("11050501")).toMatchObject({ parentId: "acc-110505", level: 5 });
    // La cuenta base deja de admitir movimientos al ganar una subcuenta, igual que al crearla a mano.
    expect(repo.byCode("1105")?.acceptsEntries).toBe(false);
    expect(repo.byCode("110505")?.acceptsEntries).toBe(false);
  });

  it("activa las cuentas del PUC que estaban inactivas, renombra subcuentas y conserva el nombre de las principales", async () => {
    const { useCase, repo } = makeUseCase();
    const result = await run(() =>
      useCase.execute({
        rows: [
          { code: "1120", name: "Cuentas de ahorro" },
          { code: "413505", name: "Venta de mercancías NIIF" },
          { code: "11", name: "Efectivo y equivalentes al efectivo" },
        ],
        dryRun: false,
      })
    );

    expect(result).toMatchObject({ created: 0, activated: 2, renamed: 1, unchanged: 1 });
    expect(repo.byCode("1120")?.isActive).toBe(true);
    expect(repo.byCode("413505")).toMatchObject({ isActive: true, name: "Venta de mercancías NIIF" });
    expect(repo.byCode("11")?.name).toBe("Disponible");
    expect(result.principalNamesKept).toEqual([{ code: "11", fileName: "Efectivo y equivalentes al efectivo", currentName: "Disponible" }]);
  });

  it("normaliza codigos con puntos o espacios y no cuenta como cambio un nombre que solo difiere en tildes o mayusculas", async () => {
    const { useCase, repo } = makeUseCase();
    const result = await run(() =>
      useCase.execute({ rows: [{ code: "1105.10", name: "Caja auxiliar" }, { code: "4135", name: "COMERCIO AL POR MAYOR Y AL POR MENOR" }], dryRun: false })
    );

    expect(result).toMatchObject({ created: 1, unchanged: 1, principalNamesKept: [] });
    expect(repo.byCode("110510")?.parentId).toBe("acc-1105");
  });

  it("omite las cuentas de orden (8 y 9) sin bloquear el resto", async () => {
    const { useCase, repo } = makeUseCase();
    const result = await run(() =>
      useCase.execute({ rows: [{ code: "8105", name: "Bienes y valores entregados en custodia" }, { code: "110515", name: "Caja eventos" }], rowNumbers: [10, 11], dryRun: false })
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toEqual([{ rowNumber: 10, code: "8105", reason: expect.stringContaining("Cuenta de orden") }]);
    expect(repo.byCode("8105")).toBeUndefined();
  });

  it("no aplica nada si una fila tiene error, y reporta cada error con su fila", async () => {
    const { useCase, repo } = makeUseCase();
    const before = repo.accounts.length;
    const result = await run(() =>
      useCase.execute({
        rows: [
          { code: "110520", name: "Caja valida" },
          { code: "", name: "Sin codigo" },
          { code: "11A5", name: "Con letras" },
          { code: "110525", name: "" },
          { code: "110520", name: "Repetida" },
          { code: "7105", name: "Sin clase 7 en el sistema ni en el archivo" },
          { code: "1120", name: "Cuentas de ahorro" },
        ],
        dryRun: false,
      })
    );

    expect(result.errors.map((e) => e.rowNumber)).toEqual([3, 4, 5, 6, 7]);
    expect(result.errors.find((e) => e.rowNumber === 6)?.messages[0]).toContain("repetido (fila 2)");
    expect(result.errors.find((e) => e.rowNumber === 7)?.messages[0]).toContain("No se encontro la cuenta padre de 7105");
    expect(repo.accounts).toHaveLength(before);
    expect(repo.byCode("1120")?.isActive).toBe(false);
  });

  it("dryRun devuelve el plan sin tocar nada; la clase 7 entra si viene en el archivo", async () => {
    const { useCase, repo } = makeUseCase();
    const before = repo.accounts.length;
    const result = await run(() =>
      useCase.execute({
        rows: [
          { code: "7", name: "Costos de produccion" },
          { code: "71", name: "Materia prima" },
          { code: "1120", name: "Cuentas de ahorro" },
        ],
        dryRun: true,
      })
    );

    expect(result).toMatchObject({ dryRun: true, created: 2, activated: 1, errors: [] });
    expect(repo.accounts).toHaveLength(before);
  });
});
