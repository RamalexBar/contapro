import { describe, expect, it } from "vitest";
import { ANNUAL_CLOSING_SOURCE, buildClosingLines } from "./annual-closing.use-case";
import { buildReturn350 } from "./withholding-return.use-case";

const accounts = [
  { id: "a4135", code: "4135", name: "Ventas", type: "INCOME" as const },
  { id: "a4295", code: "4295", name: "Diversos", type: "INCOME" as const },
  { id: "a5105", code: "5105", name: "Gastos de personal", type: "EXPENSE" as const },
  { id: "a6135", code: "6135", name: "Costo de ventas", type: "EXPENSE" as const },
  { id: "a1105", code: "1105", name: "Caja", type: "ASSET" as const },
];

describe("buildClosingLines (cierre anual)", () => {
  it("debits income and credits expenses and costs with their balance; balance accounts stay out", () => {
    const result = buildClosingLines(accounts, [
      { accountId: "a4135", debit: 50_000, credit: 10_050_000, sourceType: "Sale" },
      { accountId: "a4295", debit: 0, credit: 200_000, sourceType: null },
      { accountId: "a5105", debit: 3_000_000, credit: 0, sourceType: "Payroll" },
      { accountId: "a6135", debit: 6_000_000, credit: 100_000, sourceType: "Sale" },
      { accountId: "a1105", debit: 10_000_000, credit: 0, sourceType: "Sale" },
    ]);
    expect(result.totalIncome).toBe(10_200_000);
    expect(result.totalExpenses).toBe(8_900_000);
    expect(result.lines).toEqual([
      { accountId: "a4135", code: "4135", name: "Ventas", debit: 10_000_000, credit: 0 },
      { accountId: "a4295", code: "4295", name: "Diversos", debit: 200_000, credit: 0 },
      { accountId: "a5105", code: "5105", name: "Gastos de personal", debit: 0, credit: 3_000_000 },
      { accountId: "a6135", code: "6135", name: "Costo de ventas", debit: 0, credit: 5_900_000 },
    ]);
  });

  it("ignores a previous closing entry so it can be redone after voiding it", () => {
    const result = buildClosingLines(accounts, [
      { accountId: "a4135", debit: 0, credit: 1_000, sourceType: "Sale" },
      { accountId: "a4135", debit: 1_000, credit: 0, sourceType: ANNUAL_CLOSING_SOURCE },
    ]);
    expect(result.totalIncome).toBe(1_000);
  });
});

describe("buildReturn350 (formulario 350)", () => {
  it("groups withholdings in the form lines, keeps ReteICA apart and rounds the total to thousands", () => {
    const r = buildReturn350(2026, 11, [
      { source: "PURCHASE", type: "RETEFUENTE", conceptCode: "RF-COMPRAS", conceptName: "Compras", base: 1_000_000, amount: 25_000 },
      { source: "PURCHASE", type: "RETEFUENTE", conceptCode: "RF-SERVICIOS", conceptName: "Servicios", base: 300_000, amount: 18_000 },
      { source: "PURCHASE", type: "RETEFUENTE", conceptCode: "RF-OTRO", conceptName: "Transporte", base: 100_000, amount: 1_000 },
      { source: "PURCHASE", type: "RETEIVA", conceptCode: "IVA-RETE", conceptName: "ReteIVA", base: 190_000, amount: 28_500 },
      { source: "PURCHASE", type: "RETEICA", conceptCode: "ICA-GENERAL", conceptName: "ICA", base: 1_000_000, amount: 9_660 },
      { source: "PAYROLL", type: "RETEFUENTE", conceptCode: null, conceptName: null, base: 9_000_000, amount: 412_000 },
      { source: "BENEFIT_SETTLEMENT", type: "RETEFUENTE", conceptCode: null, conceptName: null, base: 900_000, amount: 0 },
    ]);
    expect(r.rows.map((x) => [x.line, x.amount])).toEqual([
      ["RENTAS_TRABAJO", 412_000],
      ["SERVICIOS", 18_000],
      ["COMPRAS", 25_000],
      ["OTROS_PAGOS", 1_000],
      ["RETEIVA_RESPONSABLES", 28_500],
    ]);
    expect(r.totalRetefuente).toBe(456_000);
    expect(r.totalReteiva).toBe(28_500);
    expect(r.totalToPay).toBe(485_000); // 484.500 redondeado a miles
    expect(r.reteicaInformative).toBe(9_660);
    expect(r.byAccount).toEqual({ retefuenteCompras: 44_000, retefuenteSalarios: 412_000, reteiva: 28_500 });
  });
});
