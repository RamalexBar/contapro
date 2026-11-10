import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { downloadWorkbook } from "../../../lib/spreadsheet";
import { listAllBranches } from "../api/branch.api";
import { getProfitability, type ProfitabilityGroupBy } from "../api/reports.api";

const GROUP_LABELS: Record<ProfitabilityGroupBy, string> = {
  product: "Producto",
  category: "Categoría",
  customer: "Cliente",
};

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function marginTone(margin: number | null): string {
  if (margin === null) return "text-slate-400";
  if (margin < 0) return "text-red-600 font-semibold";
  if (margin < 15) return "text-amber-600";
  return "text-emerald-700";
}

function formatMargin(margin: number | null): string {
  return margin === null ? "—" : `${margin.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
}

/** Rentabilidad real: venta sin IVA menos el costo PEPS de lo que realmente salió (primero lo comprado antes). */
export function ProfitabilitySection() {
  const now = new Date();
  const [from, setFrom] = useState(localDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(localDate(now));
  const [groupBy, setGroupBy] = useState<ProfitabilityGroupBy>("product");
  const [branchId, setBranchId] = useState("");
  const { data: branches } = useQuery({ queryKey: ["branches", "all"], queryFn: listAllBranches });

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "profitability", from, to, groupBy, branchId],
    queryFn: () => getProfitability({ from, to, groupBy, branchId: branchId || undefined }),
    enabled: !!from && !!to && from <= to,
  });

  const exportExcel = () => {
    if (!data) return;
    const rows: unknown[][] = [
      [`Rentabilidad por ${GROUP_LABELS[groupBy].toLowerCase()} del ${from} al ${to}`],
      [],
      [GROUP_LABELS[groupBy], ...(groupBy === "product" ? ["Código"] : []), "Unidades", "Venta sin IVA", "Costo real", "Utilidad", "Margen %"],
      ...data.rows.map((r) => [r.name, ...(groupBy === "product" ? [r.code ?? ""] : []), r.quantity, r.revenue, r.cost, r.profit, r.marginPercent ?? ""]),
      [],
      ["TOTAL", ...(groupBy === "product" ? [""] : []), data.totals.quantity, data.totals.revenue, data.totals.cost, data.totals.profit, data.totals.marginPercent ?? ""],
    ];
    void downloadWorkbook(`rentabilidad-${groupBy}_${from}_${to}.xlsx`, "Rentabilidad", rows, [36, ...(groupBy === "product" ? [16] : []), 10, 16, 16, 16, 10]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Agrupar por" value={groupBy} onChange={(e) => setGroupBy(e.target.value as ProfitabilityGroupBy)}>
            {(Object.keys(GROUP_LABELS) as ProfitabilityGroupBy[]).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </Select>
          <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
          {(branches?.data.length ?? 0) > 1 && (
            <Select label="Sucursal" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Todas</option>
              {branches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
          <Button size="sm" variant="secondary" disabled={!data} onClick={exportExcel}>
            Exportar a Excel
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Utilidad = venta sin IVA − costo real. El costo sale por PEPS: si compraste un producto a $250 y después a $300, se vende primero lo de
          $250 hasta que se acabe y solo entonces empieza a costar $300. Las devoluciones se restan en la fecha en que se hicieron.
        </p>
      </Card>

      {from > to && <Alert tone="warning">La fecha inicial debe ser anterior o igual a la final.</Alert>}
      {isLoading && <Spinner />}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}
      {data && data.estimatedCostLines > 0 && (
        <Alert tone="info">
          {data.estimatedCostLines} línea(s) no tenían costo guardado y se estimaron con el costo actual del producto.
        </Alert>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Venta sin IVA</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatCOP(data.totals.revenue)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Costo real</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatCOP(data.totals.cost)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Utilidad</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${data.totals.profit < 0 ? "text-red-600" : "text-slate-900"}`}>
                {formatCOP(data.totals.profit)}
              </p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Margen</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${marginTone(data.totals.marginPercent)}`}>{formatMargin(data.totals.marginPercent)}</p>
            </Card>
          </div>

          <Card noPadding>
            <Table>
              <TableHead>
                <tr>
                  <Th>{GROUP_LABELS[groupBy]}</Th>
                  <Th className="text-right">Unidades</Th>
                  <Th className="text-right">Venta sin IVA</Th>
                  <Th className="text-right">Costo real</Th>
                  <Th className="text-right">Utilidad</Th>
                  <Th className="text-right">Margen</Th>
                </tr>
              </TableHead>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow>
                    <Td colSpan={6} className="text-center text-slate-400">
                      No hubo ventas en el periodo.
                    </Td>
                  </TableRow>
                )}
                {data.rows.map((r) => (
                  <TableRow key={r.key}>
                    <Td>
                      <span className="font-medium text-slate-900">{r.name}</span>
                      {r.code && <span className="ml-2 text-xs text-slate-500">{r.code}</span>}
                    </Td>
                    <Td className="text-right tabular-nums">{r.quantity.toLocaleString("es-CO")}</Td>
                    <Td className="text-right tabular-nums">{formatCOP(r.revenue)}</Td>
                    <Td className="text-right tabular-nums">{formatCOP(r.cost)}</Td>
                    <Td className={`text-right tabular-nums ${r.profit < 0 ? "text-red-600" : ""}`}>{formatCOP(r.profit)}</Td>
                    <Td className={`text-right tabular-nums ${marginTone(r.marginPercent)}`}>{formatMargin(r.marginPercent)}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
