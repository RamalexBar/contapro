import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listBranches } from "../api/branch.api";
import { listProducts } from "../api/product.api";
import { adjustStock, registerStockEntry } from "../api/stock.api";

export function StockMovementsSection() {
  const queryClient = useQueryClient();
  const canEntry = useAuthStore((s) => s.hasPermission("stock.entry.create"));
  const canAdjust = useAuthStore((s) => s.hasPermission("stock.adjust"));

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  function invalidateStockViews() {
    queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
    queryClient.invalidateQueries({ queryKey: ["kardex"] });
  }

  const [entryForm, setEntryForm] = useState({ productId: "", branchId: "", quantity: "", unitCost: "" });
  const entryMutation = useMutation({
    mutationFn: () =>
      registerStockEntry({
        productId: entryForm.productId,
        branchId: entryForm.branchId,
        quantity: Number(entryForm.quantity),
        unitCost: Number(entryForm.unitCost),
      }),
    onSuccess: () => {
      invalidateStockViews();
      setEntryForm({ productId: "", branchId: "", quantity: "", unitCost: "" });
    },
  });

  const [adjustForm, setAdjustForm] = useState({ productId: "", branchId: "", quantityDelta: "", reason: "" });
  const adjustMutation = useMutation({
    mutationFn: () =>
      adjustStock({
        productId: adjustForm.productId,
        branchId: adjustForm.branchId,
        quantityDelta: Number(adjustForm.quantityDelta),
        reason: adjustForm.reason,
      }),
    onSuccess: () => {
      invalidateStockViews();
      setAdjustForm({ productId: "", branchId: "", quantityDelta: "", reason: "" });
    },
  });

  return (
    <div className="space-y-6">
      {canEntry && (
        <Card title="Entrada manual de stock">
          <p className="mb-3 text-sm text-slate-500">
            Para sumar stock que no viene de una compra a proveedor (ej. inventario inicial que faltaba cargar, produccion propia).
          </p>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              entryMutation.mutate();
            }}
          >
            <Select value={entryForm.productId} onChange={(e) => setEntryForm({ ...entryForm, productId: e.target.value })} required>
              <option value="">Producto...</option>
              {products?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={entryForm.branchId} onChange={(e) => setEntryForm({ ...entryForm, branchId: e.target.value })} required>
              <option value="">Sucursal...</option>
              {branches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              placeholder="Cantidad"
              value={entryForm.quantity}
              onChange={(e) => setEntryForm({ ...entryForm, quantity: e.target.value })}
              required
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Costo unitario"
              value={entryForm.unitCost}
              onChange={(e) => setEntryForm({ ...entryForm, unitCost: e.target.value })}
              required
            />
            <Button type="submit" loading={entryMutation.isPending}>
              Registrar entrada
            </Button>
          </form>
          {entryMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(entryMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      {canAdjust && (
        <Card title="Ajuste de stock">
          <p className="mb-3 text-sm text-slate-500">
            Para corregir el stock por perdida, dano, o un conteo fisico distinto al del sistema. Usa un numero negativo para restar.
          </p>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              adjustMutation.mutate();
            }}
          >
            <Select value={adjustForm.productId} onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })} required>
              <option value="">Producto...</option>
              {products?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={adjustForm.branchId} onChange={(e) => setAdjustForm({ ...adjustForm, branchId: e.target.value })} required>
              <option value="">Sucursal...</option>
              {branches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              step="0.01"
              placeholder="Cantidad (+/-)"
              value={adjustForm.quantityDelta}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantityDelta: e.target.value })}
              required
            />
            <Input placeholder="Motivo" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} required />
            <Button type="submit" loading={adjustMutation.isPending}>
              Ajustar
            </Button>
          </form>
          {adjustMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(adjustMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      {!canEntry && !canAdjust && <p className="text-sm text-slate-400">No tienes permiso para registrar movimientos de stock.</p>}
    </div>
  );
}
