import { describe, expect, it } from "vitest";
import { buildStockAlerts, buildValuationReport } from "./inventory-reports";
import type { StockLevelSnapshot } from "../domain/inventory-report.reader";

function level(overrides: Partial<StockLevelSnapshot>): StockLevelSnapshot {
  return {
    productId: "bombon",
    sku: "BOM-1",
    name: "Bombon",
    categoryName: "Dulces",
    unit: "UN",
    branchId: "b1",
    branchName: "Principal",
    quantity: 13,
    minStock: 0,
    maxStock: 0,
    currentCost: 250,
    layers: [
      { quantity: 3, unitCost: 250, enteredAt: new Date("2026-01-10T12:00:00Z"), batchNumber: "LOTE-ENE" },
      { quantity: 10, unitCost: 300, enteredAt: new Date("2026-03-10T12:00:00Z"), batchNumber: "LOTE-MAR" },
    ],
    ...overrides,
  };
}

describe("buildValuationReport", () => {
  it("valoriza cada capa a su costo real y omite productos sin existencias", () => {
    const report = buildValuationReport([level({}), level({ productId: "agotado", name: "Agotado", quantity: 0, layers: [] })]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].value).toBe(3750);
    expect(report.rows[0].unitCost).toBe(288.46);
    expect(report.rows[0].layers.map((l) => [l.quantity, l.unitCost, l.value])).toEqual([
      [3, 250, 750],
      [10, 300, 3000],
    ]);
    expect(report.totalValue).toBe(3750);
  });
});

describe("buildStockAlerts", () => {
  it("lista agotados primero y despues los que estan bajo el minimo, con lo que hay que pedir", () => {
    const alerts = buildStockAlerts([
      level({ productId: "ok", name: "Con stock", quantity: 20, minStock: 5 }),
      level({ productId: "bajo", name: "Bajo", quantity: 2, minStock: 5, maxStock: 30 }),
      level({ productId: "cero", name: "Cero", quantity: 0, minStock: 4 }),
      level({ productId: "sinmin", name: "Sin minimo", quantity: 1, minStock: 0 }),
    ]);
    expect(alerts.map((a) => [a.name, a.status, a.suggestedOrder])).toEqual([
      ["Cero", "OUT_OF_STOCK", 4],
      ["Bajo", "BELOW_MIN", 28],
    ]);
  });
});
