import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Spinner } from "../../../components/ui/Spinner";
import { listBranches } from "../api/branch.api";
import { listProducts } from "../api/product.api";
import { listKardex } from "../api/stock.api";

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_IN: "Compra",
  SALE_OUT: "Venta",
  TRANSFER_IN: "Traslado (entrada)",
  TRANSFER_OUT: "Traslado (salida)",
  ADJUSTMENT_IN: "Ajuste (+)",
  ADJUSTMENT_OUT: "Ajuste (-)",
  RETURN_IN: "Devolucion (entrada)",
  RETURN_OUT: "Devolucion (salida)",
};

export function KardexSection() {
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: kardex, isLoading } = useQuery({
    queryKey: ["kardex", productId, branchId, from, to],
    queryFn: () => listKardex({ productId, branchId: branchId || undefined, from: from || undefined, to: to || undefined }),
    enabled: Boolean(productId),
  });

  return (
    <div className="space-y-6">
      <Card title="Kardex">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Producto...</option>
            {products?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {branches?.data.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      <Card noPadding>
        {!productId ? (
          <p className="p-4 text-sm text-slate-400">Elige un producto para ver su kardex.</p>
        ) : isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Fecha</Th>
                <Th>Movimiento</Th>
                <Th>Cantidad</Th>
                <Th>Saldo</Th>
                <Th>Costo promedio</Th>
              </tr>
            </TableHead>
            <TableBody>
              {kardex?.data.map((k) => (
                <TableRow key={k.id}>
                  <Td>{new Date(k.createdAt).toLocaleString("es-CO")}</Td>
                  <Td>{MOVEMENT_LABELS[k.movementType] ?? k.movementType}</Td>
                  <Td>{k.movementQuantity}</Td>
                  <Td>{k.balanceQty}</Td>
                  <Td>{formatCOP(k.averageCost)}</Td>
                </TableRow>
              ))}
              {kardex?.data.length === 0 && (
                <TableRow>
                  <Td colSpan={5} className="text-center text-slate-400">
                    Sin movimientos en el rango elegido
                  </Td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
