import { describe, expect, it } from "vitest";
import type { AccountBalance, BalanceSheet, IncomeStatement } from "./accounting-reports.service";
import { buildNiifFinancialPosition, buildNiifProfitOrLoss } from "./niif-statements";

const acc = (code: string, name: string, balance: number): AccountBalance => ({ accountId: code, code, name, balance });

const balanceSheet: BalanceSheet = {
  asOf: "2026-12-31T00:00:00.000Z",
  assets: [
    acc("110505", "Caja general", 1_000_000),
    acc("1110", "Bancos", 4_000_000),
    acc("130505", "Clientes", 2_000_000),
    acc("135518", "Anticipo retencion IVA", 50_000),
    acc("1435", "Mercancias", 3_000_000),
    acc("1524", "Equipo de oficina", 5_000_000),
    acc("1592", "Depreciacion acumulada", -1_000_000),
    acc("9999", "Cuenta rara", 10_000),
  ],
  totalAssets: 14_060_000,
  liabilities: [
    acc("2205", "Proveedores", 2_500_000),
    acc("2408", "IVA por pagar", 300_000),
    acc("236540", "Retencion en la fuente", 40_000),
    acc("2505", "Salarios por pagar", 600_000),
    acc("2105", "Bancos nacionales", 1_000_000),
  ],
  totalLiabilities: 4_440_000,
  equity: [acc("3105", "Capital", 8_000_000)],
  totalEquity: 9_620_000,
  netIncome: 1_620_000,
};

describe("Estado de Situacion Financiera NIIF", () => {
  const fp = buildNiifFinancialPosition(balanceSheet);
  const section = (key: string) => fp.sections.find((s) => s.key === key)!;
  const line = (key: string, name: string) => section(key).lines.find((l) => l.line === name);

  it("separa corriente y no corriente con los renglones de NIIF para PYMES", () => {
    expect(line("currentAssets", "Efectivo y equivalentes al efectivo")?.amount).toBe(5_000_000);
    expect(line("currentAssets", "Deudores comerciales y otras cuentas por cobrar")?.amount).toBe(2_000_000);
    expect(line("currentAssets", "Activos por impuestos corrientes")?.amount).toBe(50_000);
    expect(line("currentAssets", "Inventarios")?.amount).toBe(3_000_000);
    // La depreciacion acumulada resta dentro de PPE
    expect(line("nonCurrentAssets", "Propiedades, planta y equipo")?.amount).toBe(4_000_000);
    expect(line("currentLiabilities", "Cuentas comerciales por pagar")?.amount).toBe(2_500_000);
    expect(line("currentLiabilities", "Pasivos por impuestos corrientes")?.amount).toBe(340_000);
    expect(line("currentLiabilities", "Beneficios a los empleados")?.amount).toBe(600_000);
  });

  it("nada se pierde y cuadra igual que el Balance General (incluido el resultado sin cerrar)", () => {
    expect(line("currentAssets", "Otros activos (sin clasificar)")?.amount).toBe(10_000);
    expect(line("equity", "Resultados acumulados sin cerrar")?.amount).toBe(1_620_000);
    expect(fp.totalAssets).toBe(balanceSheet.totalAssets);
    expect(fp.totalLiabilities).toBe(balanceSheet.totalLiabilities);
    expect(fp.totalEquity).toBe(balanceSheet.totalEquity);
    expect(fp.balanced).toBe(true);
  });
});

describe("Estado de Resultados NIIF por funcion", () => {
  const income: IncomeStatement = {
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-12-31T00:00:00.000Z",
    income: [acc("4135", "Comercio", 20_000_000), acc("421005", "Intereses", 100_000), acc("4250", "Recuperaciones", 50_000)],
    totalIncome: 20_150_000,
    expenses: [
      acc("6135", "Costo de ventas", 12_000_000),
      acc("5105", "Gastos de personal", 3_000_000),
      acc("5205", "Personal de ventas", 1_000_000),
      acc("530505", "Gastos bancarios", 200_000),
      acc("5315", "Gastos extraordinarios", 30_000),
      acc("5405", "Impuesto de renta", 1_300_000),
    ],
    totalExpenses: 17_530_000,
    netIncome: 2_620_000,
  };
  const pl = buildNiifProfitOrLoss(income);

  it("calcula ganancia bruta, operacional, antes de impuestos y del periodo", () => {
    expect(pl.lines.revenue.amount).toBe(20_000_000);
    expect(pl.lines.costOfSales.amount).toBe(12_000_000);
    expect(pl.grossProfit).toBe(8_000_000);
    expect(pl.lines.financeIncome.amount).toBe(100_000);
    expect(pl.lines.financeCosts.amount).toBe(200_000);
    expect(pl.operatingProfit).toBe(8_000_000 + 50_000 - 3_000_000 - 1_000_000 - 30_000);
    expect(pl.profitBeforeTax).toBe(pl.operatingProfit + 100_000 - 200_000);
    // Cuadra con el Estado de Resultados de siempre
    expect(pl.profitForPeriod).toBe(income.netIncome);
  });
});
