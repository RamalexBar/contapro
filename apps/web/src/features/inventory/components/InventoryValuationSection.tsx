import { Fragment, useState } from "react";
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
import { getInventoryValuation } from "../api/reports.api";

/** Inventario valorizado a hoy, con el detalle de cuántas unidades quedan a cada costo (capas PEPS). */
export function InventoryValuationSection() {
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: branches } = useQuery({ queryKey: ["branches", "all"], queryFn: listAllBranches });
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "valuation", branchId],
    queryFn: () => getInventoryValuation(branchId || undefined),
  });

  const term = search.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter((r) => !term || r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term));
  const showBranch = !branchId && (branches?.data.length ?? 0) > 1;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const exportExcel = () => {
    if (!data) return;
    const sheet: unknown[][] = [
      [`Inventario valorizado al ${new Date().toLocaleDateString("es-CO")}`],
      [],
      ["Código", "Producto", "Categoría", "Sucursal", "Unidades", "Costo unitario", "Valor", "Capas (unidades x costo)"],
      ...data.rows.map((r) => [
        r.sku,
        r.name,
        r.categoryName ?? "",
        r.branchName,
        r.quantity,
        r.unitCost,
        r.value,
        r.layers.map((l) => `${l.quantity} x ${l.unitCost}`).join(" + "),
      ]),
      [],
      ["", "TOTAL", "", "", data.totalQuantity, "", data.totalValue, ""],
    ];
    void downloadWorkbook(`inventario-valorizado_${new Date().toISOString().slice(0, 10)}.xlsx`, "Valorizado", sheet, [16, 36, 18, 20, 10, 14, 16, 40]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
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
          <Input label="Buscar producto o código" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button size="sm" variant="secondary" disabled={!data} onClick={exportExcel}>
            Exportar a Excel
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Lo que vale hoy el inventario con el costo real de cada compra. Toca un producto para ver cuántas unidades quedan a cada costo: las de
          arriba son las más viejas y son las próximas en salir.
        </p>
      </Card>

      {isLoading && <Spinner />}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Valor del inventario</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatCOP(data.totalValue)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-500">Unidades en existencia</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{data.totalQuantity.toLocaleString("es-CO")}</p>
            </Card>
          </div>

          <Card noPadding>
            <Table>
              <TableHead>
                <tr>
                  <Th>Producto</Th>
                  {showBranch && <Th>Sucursal</Th>}
                  <Th className="text-right">Unidades</Th>
                  <Th className="text-right">Costo unitario</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <Td colSpan={showBranch ? 5 : 4} className="text-center text-slate-400">
                      No hay productos con existencias.
                    </Td>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const key = `${r.productId}:${r.branchId}`;
                  const open = expanded.has(key);
                  return (
                    <Fragment key={key}>
                      <TableRow className="cursor-pointer" onClick={() => toggle(key)}>
                        <Td>
                          <span className="mr-2 inline-block w-3 text-slate-400">{r.layers.length > 1 ? (open ? "▾" : "▸") : ""}</span>
                          <span className="font-medium text-slate-900">{r.name}</span>
                          <span className="ml-2 text-xs text-slate-500">{r.sku}</span>
                        </Td>
                        {showBranch && <Td>{r.branchName}</Td>}
                        <Td className="text-right tabular-nums">
                          {r.quantity.toLocaleString("es-CO")} {r.unit}
                        </Td>
                        <Td className="text-right tabular-nums">{formatCOP(r.unitCost)}</Td>
                        <Td className="text-right font-medium tabular-nums">{formatCOP(r.value)}</Td>
                      </TableRow>
                      {open &&
                        r.layers.map((l, i) => (
                          <TableRow key={`${key}:${i}`} className="bg-slate-50 text-xs">
                            <Td className="pl-10 text-slate-500">
                              {i === 0 ? "Sale primero · " : ""}entró el {new Date(l.enteredAt).toLocaleDateString("es-CO")} ({l.batchNumber})
                            </Td>
                            {showBranch && <Td />}
                            <Td className="text-right tabular-nums">{l.quantity.toLocaleString("es-CO")}</Td>
                            <Td className="text-right tabular-nums">{formatCOP(l.unitCost)}</Td>
                            <Td className="text-right tabular-nums">{formatCOP(l.value)}</Td>
                          </TableRow>
                        ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
