import { describe, expect, it } from "vitest";
import { buildProfitabilityReport } from "./build-profitability-report";
import type { ProfitabilityLine } from "../domain/profitability.reader";

function line(overrides: Partial<ProfitabilityLine>): ProfitabilityLine {
  return {
    productId: "bombon",
    productName: "Bombon",
    sku: "BOM-1",
    categoryId: "dulces",
    categoryName: "Dulces",
    customerId: null,
    customerName: null,
    quantity: 1,
    revenue: 500,
    cost: 250,
    estimatedCost: false,
    ...overrides,
  };
}

describe("buildProfitabilityReport", () => {
  it("usa el costo real de cada venta: primero lo de $250 y despues lo de $300", () => {
    // 10 vendidos con la capa de enero ($250) y 5 con la de marzo ($300), todos a $500 sin IVA.
    const report = buildProfitabilityReport(
      [line({ quantity: 10, revenue: 5000, cost: 2500 }), line({ quantity: 5, revenue: 2500, cost: 1500 })],
      "product"
    );
    expect(report.rows).toEqual([
      { key: "bombon", name: "Bombon", code: "BOM-1", quantity: 15, revenue: 7500, cost: 4000, profit: 3500, marginPercent: 46.67 },
    ]);
    expect(report.totals.profit).toBe(3500);
    expect(report.estimatedCostLines).toBe(0);
  });

  it("resta las devoluciones y agrupa por categoria y cliente", () => {
    const lines = [
      line({ customerId: "c1", customerName: "Tienda Ana", quantity: 4, revenue: 2000, cost: 1000 }),
      line({ customerId: "c1", customerName: "Tienda Ana", quantity: -1, revenue: -500, cost: -250 }),
      line({ productId: "chicle", productName: "Chicle", categoryId: null, categoryName: null, quantity: 2, revenue: 400, cost: 100 }),
    ];

    const byCategory = buildProfitabilityReport(lines, "category");
    expect(byCategory.rows.map((r) => [r.name, r.profit])).toEqual([
      ["Dulces", 750],
      ["Sin categoria", 300],
    ]);

    const byCustomer = buildProfitabilityReport(lines, "customer");
    expect(byCustomer.rows.map((r) => [r.name, r.quantity, r.profit])).toEqual([
      ["Tienda Ana", 3, 750],
      ["Consumidor final", 2, 300],
    ]);
    expect(byCustomer.totals).toEqual({ quantity: 5, revenue: 1900, cost: 850, profit: 1050, marginPercent: 55.26 });
  });

  it("marca el margen como no calculable sin venta neta y cuenta costos estimados", () => {
    const report = buildProfitabilityReport([line({ revenue: 0, cost: 100, estimatedCost: true })], "product");
    expect(report.rows[0].marginPercent).toBeNull();
    expect(report.rows[0].profit).toBe(-100);
    expect(report.estimatedCostLines).toBe(1);
  });
});
