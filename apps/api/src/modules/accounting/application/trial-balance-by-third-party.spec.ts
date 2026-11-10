import { describe, expect, it } from "vitest";
import { buildTrialBalanceByThirdParty, type TrialBalanceLine } from "./trial-balance-by-third-party";
import type { ThirdPartyRef } from "../domain/third-party-resolver";

const accounts = [
  { id: "caja", code: "110505", name: "Caja general", type: "ASSET" as const },
  { id: "clientes", code: "130505", name: "Clientes nacionales", type: "ASSET" as const },
  { id: "ventas", code: "413505", name: "Comercio al por menor", type: "INCOME" as const },
  { id: "sin-uso", code: "220505", name: "Proveedores nacionales", type: "LIABILITY" as const },
];

const ana: ThirdPartyRef = { id: "c-ana", name: "Tienda Ana", document: "900123456" };
const beto: ThirdPartyRef = { id: "c-beto", name: "Beto Perez", document: "1088000111" };
const thirdPartyByKey = new Map<string, ThirdPartyRef>([
  ["Sale:s1", ana],
  ["Sale:s2", beto],
  ["AccountReceivablePayment:p1", ana],
]);

function line(accountId: string, date: string, debit: number, credit: number, sourceType: string | null, sourceId: string | null): TrialBalanceLine {
  return { accountId, date: new Date(date), debit, credit, sourceType, sourceId };
}

const from = new Date("2026-11-01T05:00:00.000Z");
const to = new Date("2026-12-01T04:59:59.999Z");

describe("buildTrialBalanceByThirdParty", () => {
  const lines = [
    // Saldo anterior: venta a credito a Ana en octubre.
    line("clientes", "2026-10-15T15:00:00Z", 1000, 0, "Sale", "s1"),
    line("ventas", "2026-10-15T15:00:00Z", 0, 1000, "Sale", "s1"),
    // Ingreso de 2025: no debe arrastrarse al saldo inicial de 2026 (cuenta de resultado).
    line("ventas", "2025-06-01T15:00:00Z", 0, 777, "Sale", "s2"),
    line("caja", "2025-06-01T15:00:00Z", 777, 0, "Sale", "s2"),
    // Periodo: Ana abona 600, Beto compra de contado 300, consumidor final 50.
    line("caja", "2026-11-03T15:00:00Z", 600, 0, "AccountReceivablePayment", "p1"),
    line("clientes", "2026-11-03T15:00:00Z", 0, 600, "AccountReceivablePayment", "p1"),
    line("caja", "2026-11-04T15:00:00Z", 300, 0, "Sale", "s2"),
    line("ventas", "2026-11-04T15:00:00Z", 0, 300, "Sale", "s2"),
    line("caja", "2026-11-05T15:00:00Z", 50, 0, "Sale", "s3"),
    line("ventas", "2026-11-05T15:00:00Z", 0, 50, "Sale", "s3"),
    // Despues del corte: no cuenta.
    line("caja", "2026-12-02T15:00:00Z", 999, 0, null, null),
  ];

  const report = buildTrialBalanceByThirdParty({ from, to, accounts, lines, thirdPartyByKey });

  it("abre cada cuenta por tercero con saldo inicial, movimientos y saldo final", () => {
    const clientes = report.accounts.find((a) => a.code === "130505")!;
    expect(clientes.thirdParties).toEqual([
      { thirdPartyId: "c-ana", name: "Tienda Ana", document: "900123456", opening: 1000, debit: 0, credit: 600, closing: 400 },
    ]);
    expect(clientes.closing).toBe(400);

    const caja = report.accounts.find((a) => a.code === "110505")!;
    expect(caja.thirdParties.map((p) => [p.name, p.opening, p.debit, p.closing])).toEqual([
      ["Beto Perez", 777, 300, 1077],
      ["Tienda Ana", 0, 600, 600],
      ["Sin tercero identificado", 0, 50, 50],
    ]);
  });

  it("las cuentas de resultado arrancan en cero cada 1 de enero y son de naturaleza credito", () => {
    const ventas = report.accounts.find((a) => a.code === "413505")!;
    expect(ventas.nature).toBe("CREDIT");
    expect(ventas.opening).toBe(1000);
    expect(ventas.closing).toBe(1350);
  });

  it("omite cuentas sin saldo ni movimiento, ordena por codigo y cuadra debitos con creditos", () => {
    expect(report.accounts.map((a) => a.code)).toEqual(["110505", "130505", "413505"]);
    expect(report.totalDebit).toBe(950);
    expect(report.totalCredit).toBe(950);
  });
});
