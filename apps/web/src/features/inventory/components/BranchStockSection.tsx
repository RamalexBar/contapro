import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { createBranch, listBranches } from "../api/branch.api";
import { listProducts } from "../api/product.api";
import { listBranchStock, transferStock } from "../api/stock.api";

/**
 * Traslados entre sucursales (lo que originalmente bloqueaba este modulo, ver
 * branches.routes.ts): antes de GET /branches no habia forma de mostrarle al usuario un selector
 * de sucursal origen/destino -- lo unico que existia era `user.branchId` (la sucursal por defecto
 * del usuario logueado).
 */
export function BranchStockSection() {
  const queryClient = useQueryClient();
  const canManageBranches = useAuthStore((s) => s.hasPermission("branch.manage"));
  const canTransfer = useAuthStore((s) => s.hasPermission("stock.transfer"));

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  const [branchForm, setBranchForm] = useState({ name: "", address: "", phone: "" });
  const createBranchMutation = useMutation({
    mutationFn: () =>
      createBranch({
        name: branchForm.name,
        address: branchForm.address || undefined,
        phone: branchForm.phone || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setBranchForm({ name: "", address: "", phone: "" });
    },
  });

  const [viewBranchId, setViewBranchId] = useState("");
  const { data: branchStock, isLoading: loadingStock } = useQuery({
    queryKey: ["branch-stock", viewBranchId],
    queryFn: () => listBranchStock(viewBranchId),
    enabled: Boolean(viewBranchId),
  });

  function productName(productId: string) {
    return products?.data.find((p) => p.id === productId)?.name ?? productId;
  }

  const [form, setForm] = useState({ productId: "", fromBranchId: "", toBranchId: "", quantity: "" });
  const transferMutation = useMutation({
    mutationFn: () =>
      transferStock({
        productId: form.productId,
        fromBranchId: form.fromBranchId,
        toBranchId: form.toBranchId,
        quantity: Number(form.quantity),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-stock"] });
      setForm({ productId: "", fromBranchId: "", toBranchId: "", quantity: "" });
    },
  });

  return (
    <div className="space-y-6">
      {canManageBranches && (
        <Card title="Nueva sucursal">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createBranchMutation.mutate();
            }}
          >
            <Input placeholder="Nombre" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required />
            <Input
              placeholder="Direccion (opcional)"
              value={branchForm.address}
              onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
            />
            <Input
              placeholder="Telefono (opcional)"
              value={branchForm.phone}
              onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
            />
            <Button type="submit" loading={createBranchMutation.isPending}>
              Crear sucursal
            </Button>
          </form>
          {createBranchMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(createBranchMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      <Card title="Stock por sucursal">
        <Select className="mb-3" value={viewBranchId} onChange={(e) => setViewBranchId(e.target.value)}>
          <option value="">Seleccionar sucursal...</option>
          {branches?.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.isMain ? " (principal)" : ""}
            </option>
          ))}
        </Select>
        {loadingStock ? (
          <Spinner />
        ) : viewBranchId ? (
          <Table>
            <TableHead>
              <tr>
                <Th>Producto</Th>
                <Th>Cantidad</Th>
                <Th>Min</Th>
                <Th>Max</Th>
              </tr>
            </TableHead>
            <TableBody>
              {branchStock?.data.map((s) => (
                <TableRow key={s.productId}>
                  <Td className="font-medium text-slate-900">{productName(s.productId)}</Td>
                  <Td>{s.quantity}</Td>
                  <Td>{s.minStock}</Td>
                  <Td>{s.maxStock}</Td>
                </TableRow>
              ))}
              {branchStock?.data.length === 0 && (
                <TableRow>
                  <Td colSpan={4} className="text-center text-slate-400">
                    Sin stock registrado en esta sucursal
                  </Td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-slate-400">Elige una sucursal para ver su stock.</p>
        )}
      </Card>

      {canTransfer && (
        <Card title="Trasladar stock entre sucursales">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              transferMutation.mutate();
            }}
          >
            <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">Producto...</option>
              {products?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={form.fromBranchId} onChange={(e) => setForm({ ...form, fromBranchId: e.target.value })} required>
              <option value="">Desde...</option>
              {branches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select value={form.toBranchId} onChange={(e) => setForm({ ...form, toBranchId: e.target.value })} required>
              <option value="">Hacia...</option>
              {branches?.data
                .filter((b) => b.id !== form.fromBranchId)
                .map((b) => (
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
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
            <Button type="submit" loading={transferMutation.isPending} disabled={!form.fromBranchId || form.fromBranchId === form.toBranchId}>
              Trasladar
            </Button>
          </form>
          {transferMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(transferMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}
    </div>
  );
}
