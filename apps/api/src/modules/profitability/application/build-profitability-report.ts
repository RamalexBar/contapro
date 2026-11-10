import { round2 } from "@erp/shared-utils";
import type { ProfitabilityLine } from "../domain/profitability.reader";

export type ProfitabilityGroupBy = "product" | "category" | "customer";

export interface ProfitabilityRow {
  key: string;
  name: string;
  /** SKU cuando se agrupa por producto. */
  code: string | null;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  /** Utilidad / venta neta x 100. null si no hubo venta neta (no se puede calcular). */
  marginPercent: number | null;
}

export interface ProfitabilityReport {
  groupBy: ProfitabilityGroupBy;
  rows: ProfitabilityRow[];
  totals: Omit<ProfitabilityRow, "key" | "name" | "code">;
  /** Lineas cuyo costo se estimo (no tenian costo PEPS guardado). 0 = todo el reporte es costo real. */
  estimatedCostLines: number;
}

const NO_CATEGORY = "Sin categoria";
const NO_CUSTOMER = "Consumidor final";

function marginOf(revenue: number, profit: number): number | null {
  return Math.abs(revenue) < 0.005 ? null : round2((profit / revenue) * 100);
}

function groupKey(line: ProfitabilityLine, groupBy: ProfitabilityGroupBy): { key: string; name: string; code: string | null } {
  if (groupBy === "product") return { key: line.productId, name: line.productName, code: line.sku };
  if (groupBy === "category") return { key: line.categoryId ?? "none", name: line.categoryName ?? NO_CATEGORY, code: null };
  return { key: line.customerId ?? "none", name: line.customerName ?? NO_CUSTOMER, code: null };
}

/**
 * Rentabilidad = venta neta sin IVA - costo real PEPS, agrupada por producto, categoria o cliente. Las devoluciones
 * entran como lineas negativas en el periodo en que se hicieron. Filas ordenadas de mayor a menor utilidad.
 */
export function buildProfitabilityReport(lines: ProfitabilityLine[], groupBy: ProfitabilityGroupBy): ProfitabilityReport {
  const groups = new Map<string, { name: string; code: string | null; quantity: number; revenue: number; cost: number }>();
  let estimatedCostLines = 0;

  for (const line of lines) {
    if (line.estimatedCost) estimatedCostLines += 1;
    const { key, name, code } = groupKey(line, groupBy);
    const group = groups.get(key) ?? { name, code, quantity: 0, revenue: 0, cost: 0 };
    group.quantity += line.quantity;
    group.revenue += line.revenue;
    group.cost += line.cost;
    groups.set(key, group);
  }

  const rows: ProfitabilityRow[] = [...groups.entries()].map(([key, g]) => {
    const revenue = round2(g.revenue);
    const cost = round2(g.cost);
    const profit = round2(revenue - cost);
    return { key, name: g.name, code: g.code, quantity: round2(g.quantity), revenue, cost, profit, marginPercent: marginOf(revenue, profit) };
  });
  rows.sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));

  const revenue = round2(rows.reduce((s, r) => s + r.revenue, 0));
  const cost = round2(rows.reduce((s, r) => s + r.cost, 0));
  const profit = round2(revenue - cost);
  return {
    groupBy,
    rows,
    totals: { quantity: round2(rows.reduce((s, r) => s + r.quantity, 0)), revenue, cost, profit, marginPercent: marginOf(revenue, profit) },
    estimatedCostLines,
  };
}
