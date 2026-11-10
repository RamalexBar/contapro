import { round2 } from "@erp/shared-utils";
import { valueStock } from "../domain/fifo-cost";
import type { StockLevelSnapshot } from "../domain/inventory-report.reader";

export interface ValuationRow {
  productId: string;
  sku: string;
  name: string;
  categoryName: string | null;
  unit: string;
  branchId: string;
  branchName: string;
  quantity: number;
  /** Valor real del saldo (capas PEPS). */
  value: number;
  /** value / quantity: costo unitario del saldo. */
  unitCost: number;
  layers: Array<{ quantity: number; unitCost: number; value: number; enteredAt: string; batchNumber: string }>;
}

export interface ValuationReport {
  rows: ValuationRow[];
  totalQuantity: number;
  totalValue: number;
}

/** Inventario valorizado al dia de hoy: cada producto/sucursal con existencias y el detalle de sus capas PEPS
 * (ej. 3 bombones a $250 + 10 a $300). Ordenado de mayor a menor valor. */
export function buildValuationReport(levels: StockLevelSnapshot[]): ValuationReport {
  const rows: ValuationRow[] = levels
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const value = round2(valueStock(l.layers.map((x, i) => ({ id: String(i), ...x })), l.quantity, l.currentCost));
      return {
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        categoryName: l.categoryName,
        unit: l.unit,
        branchId: l.branchId,
        branchName: l.branchName,
        quantity: l.quantity,
        value,
        unitCost: round2(value / l.quantity),
        layers: l.layers.map((x) => ({
          quantity: x.quantity,
          unitCost: x.unitCost,
          value: round2(x.quantity * x.unitCost),
          enteredAt: x.enteredAt.toISOString(),
          batchNumber: x.batchNumber,
        })),
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    rows,
    totalQuantity: round2(rows.reduce((s, r) => s + r.quantity, 0)),
    totalValue: round2(rows.reduce((s, r) => s + r.value, 0)),
  };
}

export type StockAlertStatus = "OUT_OF_STOCK" | "BELOW_MIN";

export interface StockAlertRow {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  branchId: string;
  branchName: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  status: StockAlertStatus;
  /** Cuanto pedir para volver al maximo (o al minimo si no hay maximo configurado). */
  suggestedOrder: number;
}

/** Productos agotados (existencias <= 0) o por debajo de su minimo configurado (minStock > 0), agotados primero. */
export function buildStockAlerts(levels: StockLevelSnapshot[]): StockAlertRow[] {
  const rows: StockAlertRow[] = [];
  for (const l of levels) {
    const out = l.quantity <= 0;
    const below = l.minStock > 0 && l.quantity < l.minStock;
    if (!out && !below) continue;
    const target = l.maxStock > l.minStock ? l.maxStock : l.minStock;
    rows.push({
      productId: l.productId,
      sku: l.sku,
      name: l.name,
      unit: l.unit,
      branchId: l.branchId,
      branchName: l.branchName,
      quantity: l.quantity,
      minStock: l.minStock,
      maxStock: l.maxStock,
      status: out ? "OUT_OF_STOCK" : "BELOW_MIN",
      suggestedOrder: round2(Math.max(0, target - Math.max(0, l.quantity))),
    });
  }
  return rows.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "OUT_OF_STOCK" ? -1 : 1));
}
