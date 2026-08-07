import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { createProduct, deleteProduct, listProducts, updateProductPrice } from "../api/product.api";
import {
  createPriceList,
  deactivatePriceList,
  listPriceLists,
  listProductPrices,
  removeProductPrice,
  setProductPrice,
  updatePriceList,
} from "../api/price-list.api";

function ProductsSection() {
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
    <>
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
    </>
  );
}

function PriceListsSection() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("price-list.manage"));
  const { data: priceLists, isLoading } = useQuery({ queryKey: ["price-lists"], queryFn: listPriceLists });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  const [form, setForm] = useState({ code: "", name: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");

  function invalidateLists() {
    return queryClient.invalidateQueries({ queryKey: ["price-lists"] });
  }

  const createMutation = useMutation({
    mutationFn: () => createPriceList(form),
    onSuccess: () => {
      invalidateLists();
      setForm({ code: "", name: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => updatePriceList(id, { name: editName }),
    onSuccess: () => {
      invalidateLists();
      setEditingId(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivatePriceList,
    onSuccess: () => invalidateLists(),
  });

  const { data: productPrices } = useQuery({
    queryKey: ["price-list-prices", selectedListId],
    queryFn: () => listProductPrices(selectedListId),
    enabled: Boolean(selectedListId),
  });

  const setPriceMutation = useMutation({
    mutationFn: ({ productId, price }: { productId: string; price: number }) => setProductPrice(selectedListId, productId, price),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-list-prices", selectedListId] }),
  });

  const removePriceMutation = useMutation({
    mutationFn: (productId: string) => removeProductPrice(selectedListId, productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-list-prices", selectedListId] }),
  });

  function overrideFor(productId: string): number | undefined {
    return productPrices?.data.find((p) => p.productId === productId)?.price;
  }

  return (
    <>
      {canManage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva lista de precios</h2>
          <p className="mb-3 text-sm text-gray-500">
            Cada lista puede tener un precio distinto por producto (ej. mayorista, VIP). Si un producto no tiene
            precio en la lista, se cobra el precio base del catalogo.
          </p>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Button type="submit" disabled={createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
        </Card>
      )}

      <Card className="mb-6">
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Codigo</th>
              <th>Nombre</th>
              <th>Activa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {priceLists?.data.map((l) =>
              editingId === l.id ? (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-2">{l.code}</td>
                  <td>
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </td>
                  <td>{l.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(l.id)}>
                      Guardar
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-2">{l.code}</td>
                  <td>{l.name}</td>
                  <td>{l.isActive ? "Si" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    {canManage && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(l.id);
                            setEditName(l.name);
                          }}
                        >
                          Editar
                        </Button>
                        {l.isActive && (
                          <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(l.id)}>
                            Desactivar
                          </Button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Precios por producto</h2>
        <select
          className="mb-3 rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={selectedListId}
          onChange={(e) => setSelectedListId(e.target.value)}
        >
          <option value="">Seleccionar lista...</option>
          {priceLists?.data.filter((l) => l.isActive).map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} {l.name}
            </option>
          ))}
        </select>
        {selectedListId && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Producto</th>
                <th>Precio base</th>
                <th>Precio en esta lista</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products?.data.map((p) => {
                const override = overrideFor(p.id);
                return (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2">{p.name}</td>
                    <td>{formatCOP(p.currentPrice)}</td>
                    <td>
                      {canManage ? (
                        <input
                          type="number"
                          defaultValue={override}
                          placeholder="Usa el precio base"
                          className="w-28 rounded border border-gray-200 px-2 py-1"
                          key={override}
                          onBlur={(e) => {
                            const price = Number(e.target.value);
                            if (e.target.value && price !== override) setPriceMutation.mutate({ productId: p.id, price });
                          }}
                        />
                      ) : (
                        override !== undefined ? formatCOP(override) : "-"
                      )}
                    </td>
                    <td>
                      {canManage && override !== undefined && (
                        <Button variant="secondary" onClick={() => removePriceMutation.mutate(p.id)}>
                          Quitar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

type Section = "products" | "price-lists";

export function ProductListPage() {
  const [section, setSection] = useState<Section>("products");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Inventario</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "products" ? "primary" : "secondary"} onClick={() => setSection("products")}>
          Productos
        </Button>
        <Button variant={section === "price-lists" ? "primary" : "secondary"} onClick={() => setSection("price-lists")}>
          Listas de precios
        </Button>
      </div>

      {section === "products" && <ProductsSection />}
      {section === "price-lists" && <PriceListsSection />}
    </AppLayout>
  );
}
