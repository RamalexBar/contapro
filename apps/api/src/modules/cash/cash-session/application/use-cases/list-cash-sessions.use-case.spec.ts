import { describe, expect, it } from "vitest";
import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";
import { GetActiveSessionUseCase } from "./get-active-session.use-case";
import { ListCashSessionsUseCase } from "./list-cash-sessions.use-case";

function session(overrides: Partial<CashSessionRecord>): CashSessionRecord {
  return {
    id: "s1",
    branchId: "b1",
    cashRegisterId: "r1",
    openedByUserId: "admin",
    closedByUserId: null,
    openingAmount: 100_000,
    closingAmountExpected: null,
    closingAmountCounted: null,
    difference: null,
    status: "OPEN",
    openedAt: new Date("2026-10-12T15:00:00Z"),
    closedAt: null,
    ...overrides,
  };
}

const NAMES = new Map([
  ["admin", "Alexander Barrios"],
  ["cajero", "Cajero Uno"],
]);

function fakeRepo(sessions: CashSessionRecord[], net = 0): ICashSessionRepository {
  return {
    findActiveByRegister: async () => sessions.find((s) => s.status === "OPEN") ?? null,
    sumMovements: async () => net,
    listByRegister: async (_id: string, limit: number) => sessions.slice(0, limit),
    findUserNames: async (ids: string[]) => new Map(ids.filter((id) => NAMES.has(id)).map((id) => [id, NAMES.get(id)!])),
  } as unknown as ICashSessionRepository;
}

describe("GetActiveSessionUseCase", () => {
  it("returns who opened the shift and how much cash there should be", async () => {
    const result = await new GetActiveSessionUseCase(fakeRepo([session({})], 45_500)).execute("r1");

    expect(result).toMatchObject({ openedByName: "Alexander Barrios", expectedAmount: 145_500 });
  });

  it("returns null when the register has no open shift", async () => {
    expect(await new GetActiveSessionUseCase(fakeRepo([session({ status: "CLOSED" })])).execute("r1")).toBeNull();
  });
});

describe("ListCashSessionsUseCase", () => {
  it("lists shifts with the names of who opened and closed each one", async () => {
    const sessions = [
      session({ id: "s2", openedByUserId: "cajero" }),
      session({ id: "s1", status: "CLOSED", closedByUserId: "admin", difference: -5_000 }),
    ];

    const result = await new ListCashSessionsUseCase(fakeRepo(sessions)).execute("r1");

    expect(result.map((s) => [s.id, s.openedByName, s.closedByName])).toEqual([
      ["s2", "Cajero Uno", null],
      ["s1", "Alexander Barrios", "Alexander Barrios"],
    ]);
  });

  it("caps the page size at 100", async () => {
    const many = Array.from({ length: 150 }, (_, i) => session({ id: `s${i}`, status: "CLOSED" }));
    expect(await new ListCashSessionsUseCase(fakeRepo(many)).execute("r1", 500)).toHaveLength(100);
  });
});
