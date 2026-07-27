import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { createProduct, deleteProduct, listProducts, updateProductPrice } from "../api/product.api";

export function ProductListPage() {
  const queryClient = useQueryClient();
  const canManagePrice = useAuthStore((s) => s.hasPermission("product.price.update"));
  const canDelete = useAuthStore((s) => s.hasPermission("product.delete"));
  const canCreate = useAuthStore((s) => s.hasPermission("product.create"));

  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  const [form, setForm] = useState({ sku: "", name: "", currentPrice: "", currentCost: "", barcode: "" });
  const createMutation = useMutation({
    mutationFn: () =>
      createProduct({
        sku: form.sku,
        name: form.name,
        currentPrice: Number(form.currentPrice),
        currentCost: Number(form.currentCost),
        barcode: form.barcode || undefined,
        unit: "UN",
        taxRate: 19,
        initialStock: 0,
        minStock: 0,
        maxStock: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setForm({ sku: "", name: "", currentPrice: "", currentCost: "", barcode: "" });
    },
  });

  const priceMutation = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => updateProductPrice(id, price),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Inventario</h1>

      {canCreate && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo producto</h2>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input
              placeholder="Precio"
              type="number"
              value={form.currentPrice}
              onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
              required
            />
            <Input
              placeholder="Costo"
              type="number"
              value={form.currentCost}
              onChange={(e) => setForm({ ...form, currentCost: e.target.value })}
              required
            />
            <Input
              placeholder="Codigo de barras"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
            <Button type="submit" disabled={createMutation.isPending} className="col-span-2 sm:col-span-1">
              Crear
            </Button>
          </form>
        </Card>
      )}

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">SKU</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Costo</th>
              <th>Codigo de barras</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">{p.sku}</td>
                <td>{p.name}</td>
                <td>
                  {canManagePrice ? (
                    <input
                      type="number"
                      defaultValue={p.currentPrice}
                      className="w-24 rounded border border-gray-200 px-2 py-1"
                      onBlur={(e) => {
                        const price = Number(e.target.value);
                        if (price !== p.currentPrice) priceMutation.mutate({ id: p.id, price });
                      }}
                    />
                  ) : (
                    formatCOP(p.currentPrice)
                  )}
                </td>
                <td>{formatCOP(p.currentCost)}</td>
                <td>{p.barcodes.join(", ")}</td>
                <td>
                  {canDelete && (
                    <Button variant="danger" onClick={() => deleteMutation.mutate(p.id)}>
                      Eliminar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppLayout>
  );
}
