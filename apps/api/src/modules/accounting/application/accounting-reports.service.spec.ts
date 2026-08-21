import { describe, expect, it } from "vitest";
import type { AccountRecord, IChartOfAccountsRepository } from "../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository, PostedLineAggregate } from "../domain/journal-entry.repository";
import type { IThirdPartyResolver, ThirdPartyRef } from "../domain/third-party-resolver";
import { AccountingReportsService } from "./accounting-reports.service";

const ACCOUNTS: AccountRecord[] = [
  { id: "acc-caja", code: "1105", name: "Caja general", type: "ASSET", parentId: null, level: 3, isActive: true, acceptsEntries: true },
  { id: "acc-clientes", code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET", parentId: null, level: 3, isActive: true, acceptsEntries: true },
  { id: "acc-proveedores", code: "2205", name: "Proveedores nacionales", type: "LIABILITY", parentId: null, level: 3, isActive: true, acceptsEntries: true },
  { id: "acc-ingresos", code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME", parentId: null, level: 3, isActive: true, acceptsEntries: true },
  { id: "acc-gastos", code: "5105", name: "Gastos de personal", type: "EXPENSE", parentId: null, level: 3, isActive: true, acceptsEntries: true },
];

function line(overrides: Partial<PostedLineAggregate> = {}): PostedLineAggregate {
  return {
    id: `line-${Math.random()}`,
    accountId: "acc-caja",
    debit: 0,
    credit: 0,
    date: new Date("2026-08-01"),
    entryId: "entry-1",
    entryNumber: 1,
    description: null,
    sourceType: null,
    sourceId: null,
    ...overrides,
  };
}

const LINES: PostedLineAggregate[] = [
  line({ accountId: "acc-caja", debit: 100 }),
  line({ accountId: "acc-clientes", debit: 50, sourceType: "Sale", sourceId: "sale-1" }),
  line({ accountId: "acc-clientes", debit: 30, sourceType: "Sale", sourceId: "sale-2" }),
  line({ accountId: "acc-clientes", debit: 20, sourceType: "MANUAL", sourceId: "adj-1" }),
  line({ accountId: "acc-proveedores", credit: 40, sourceType: "Purchase", sourceId: "purchase-1" }),
  line({ accountId: "acc-ingresos", credit: 100 }),
  line({ accountId: "acc-gastos", debit: 100 }),
];

class FakeChartOfAccountsRepository implements Partial<IChartOfAccountsRepository> {
  async list(): Promise<AccountRecord[]> {
    return ACCOUNTS;
  }
}

class FakeJournalEntryRepository implements Partial<IJournalEntryRepository> {
  async listPostedLines(): Promise<PostedLineAggregate[]> {
    return LINES;
  }
}

const THIRD_PARTY_MAP = new Map<string, ThirdPartyRef>([
  ["Sale:sale-1", { id: "cust-juan", name: "Juan Perez" }],
  ["Sale:sale-2", { id: "cust-maria", name: "Maria Lopez" }],
  ["Purchase:purchase-1", { id: "sup-x", name: "Proveedor X" }],
]);

class FakeThirdPartyResolver implements IThirdPartyResolver {
  async resolveForLines(lines: { sourceType: string | null; sourceId: string | null }[]): Promise<Map<string, ThirdPartyRef>> {
    const result = new Map<string, ThirdPartyRef>();
    for (const l of lines) {
      const key = l.sourceType && l.sourceId ? `${l.sourceType}:${l.sourceId}` : null;
      if (key && THIRD_PARTY_MAP.has(key)) result.set(key, THIRD_PARTY_MAP.get(key)!);
    }
    return result;
  }
}

function makeService() {
  return new AccountingReportsService(
    new FakeJournalEntryRepository() as unknown as IJournalEntryRepository,
    new FakeChartOfAccountsRepository() as unknown as IChartOfAccountsRepository,
    {} as never,
    {} as never,
    new FakeThirdPartyResolver()
  );
}

describe("AccountingReportsService.getBalanceSheet", () => {
  it("aggregates each account into a single total when byThirdParty is not requested (regression)", async () => {
    const sheet = await makeService().getBalanceSheet(new Date("2026-08-31"));

    const clientes = sheet.assets.find((a) => a.code === "1305");
    expect(clientes?.balance).toBe(100);
    expect(clientes?.thirdPartyName).toBeUndefined();

    const proveedores = sheet.liabilities.find((a) => a.code === "2205");
    expect(proveedores?.balance).toBe(40);
  });

  it("breaks down Clientes/Proveedores by third party when byThirdParty is true", async () => {
    const sheet = await makeService().getBalanceSheet(new Date("2026-08-31"), { byThirdParty: true });

    const clientesRows = sheet.assets.filter((a) => a.code === "1305");
    expect(clientesRows).toHaveLength(3);
    expect(clientesRows.find((r) => r.thirdPartyName === "Juan Perez")?.balance).toBe(50);
    expect(clientesRows.find((r) => r.thirdPartyName === "Maria Lopez")?.balance).toBe(30);
    expect(clientesRows.find((r) => r.thirdPartyName === "Sin tercero identificado")?.balance).toBe(20);

    const proveedoresRows = sheet.liabilities.filter((a) => a.code === "2205");
    expect(proveedoresRows).toHaveLength(1);
    expect(proveedoresRows[0].thirdPartyName).toBe("Proveedor X");
    expect(proveedoresRows[0].balance).toBe(40);
  });

  it("leaves accounts outside the breakdown set untouched when byThirdParty is true", async () => {
    const sheet = await makeService().getBalanceSheet(new Date("2026-08-31"), { byThirdParty: true });

    const caja = sheet.assets.find((a) => a.code === "1105");
    expect(caja?.balance).toBe(100);
    expect(caja?.thirdPartyName).toBeUndefined();
  });

  it("keeps totals consistent between the aggregated and the by-third-party views", async () => {
    const [normal, byThirdParty] = await Promise.all([
      makeService().getBalanceSheet(new Date("2026-08-31")),
      makeService().getBalanceSheet(new Date("2026-08-31"), { byThirdParty: true }),
    ]);

    expect(byThirdParty.totalAssets).toBe(normal.totalAssets);
    expect(byThirdParty.totalLiabilities).toBe(normal.totalLiabilities);
  });
});
