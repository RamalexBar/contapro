import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { listAllBranches } from "../api/branch.api";
import { listStockAlerts } from "../api/reports.api";

/** Productos agotados o por debajo del mínimo configurado, con cuánto pedir para volver al máximo. */
export function StockAlertsSection() {
  const [branchId, setBranchId] = useState("");
  const { data: branches } = useQuery({ queryKey: ["branches", "all"], queryFn: listAllBranches });
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "stock-alerts", branchId],
    queryFn: () => listStockAlerts(branchId || undefined),
  });
  const showBranch = !branchId && (branches?.data.length ?? 0) > 1;
  const outCount = data?.data.filter((a) => a.status === "OUT_OF_STOCK").length ?? 0;
  const belowCount = (data?.data.length ?? 0) - outCount;

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
          {data && (
            <p className="pb-2 text-sm text-slate-600">
              <span className="font-semibold text-red-600">{outCount}</span> agotado(s) ·{" "}
              <span className="font-semibold text-amber-600">{belowCount}</span> bajo el mínimo
            </p>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          El mínimo y el máximo de cada producto se configuran por sucursal. "Pedir" es lo que falta para llegar al máximo (o al mínimo si no tiene
          máximo).
        </p>
      </Card>

      {isLoading && <Spinner />}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}

      {data && (
        <Card noPadding>
          <Table>
            <TableHead>
              <tr>
                <Th>Producto</Th>
                {showBranch && <Th>Sucursal</Th>}
                <Th>Estado</Th>
                <Th className="text-right">Existencias</Th>
                <Th className="text-right">Mínimo</Th>
                <Th className="text-right">Máximo</Th>
                <Th className="text-right">Pedir</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data.data.length === 0 && (
                <TableRow>
                  <Td colSpan={showBranch ? 7 : 6} className="text-center text-slate-400">
                    Todo en orden: ningún producto agotado ni bajo el mínimo.
                  </Td>
                </TableRow>
              )}
              {data.data.map((a) => (
                <TableRow key={`${a.productId}:${a.branchId}`}>
                  <Td>
                    <span className="font-medium text-slate-900">{a.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{a.sku}</span>
                  </Td>
                  {showBranch && <Td>{a.branchName}</Td>}
                  <Td>{a.status === "OUT_OF_STOCK" ? <Badge tone="danger">Agotado</Badge> : <Badge tone="warning">Bajo el mínimo</Badge>}</Td>
                  <Td className="text-right tabular-nums">
                    {a.quantity.toLocaleString("es-CO")} {a.unit}
                  </Td>
                  <Td className="text-right tabular-nums">{a.minStock.toLocaleString("es-CO")}</Td>
                  <Td className="text-right tabular-nums">{a.maxStock ? a.maxStock.toLocaleString("es-CO") : "—"}</Td>
                  <Td className="text-right font-semibold tabular-nums">{a.suggestedOrder.toLocaleString("es-CO")}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
