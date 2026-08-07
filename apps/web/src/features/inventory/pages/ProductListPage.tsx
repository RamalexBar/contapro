import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
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
    <div className="space-y-6">
      {canCreate && (
        <Card title="Nuevo producto">
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
            <Input placeholder="Codigo de barras" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <Button type="submit" loading={createMutation.isPending} className="col-span-2 sm:col-span-1">
              Crear
            </Button>
          </form>
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>SKU</Th>
                <Th>Nombre</Th>
                <Th>Precio</Th>
                <Th>Costo</Th>
                <Th>Codigo de barras</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((p) => (
                <TableRow key={p.id}>
                  <Td className="font-medium text-slate-900">{p.sku}</Td>
                  <Td>{p.name}</Td>
                  <Td>
                    {canManagePrice ? (
                      <Input
                        type="number"
                        defaultValue={p.currentPrice}
                        className="w-24"
                        onBlur={(e) => {
                          const price = Number(e.target.value);
                          if (price !== p.currentPrice) priceMutation.mutate({ id: p.id, price });
                        }}
                      />
                    ) : (
                      formatCOP(p.currentPrice)
                    )}
                  </Td>
                  <Td>{formatCOP(p.currentCost)}</Td>
                  <Td>{p.barcodes.join(", ")}</Td>
                  <Td>
                    {canDelete && (
                      <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(p.id)}>
                        Eliminar
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
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
    <div className="space-y-6">
      {canManage && (
        <Card title="Nueva lista de precios">
          <p className="mb-3 text-sm text-slate-500">
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
            <Button type="submit" loading={createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(createMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Codigo</Th>
                <Th>Nombre</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {priceLists?.data.map((l) =>
                editingId === l.id ? (
                  <TableRow key={l.id}>
                    <Td className="font-medium text-slate-900">{l.code}</Td>
                    <Td>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </Td>
                    <Td>
                      <Badge tone={l.isActive ? "success" : "neutral"}>{l.isActive ? "Activa" : "Inactiva"}</Badge>
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(l.id)}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </Td>
                  </TableRow>
                ) : (
                  <TableRow key={l.id}>
                    <Td className="font-medium text-slate-900">{l.code}</Td>
                    <Td>{l.name}</Td>
                    <Td>
                      <Badge tone={l.isActive ? "success" : "neutral"}>{l.isActive ? "Activa" : "Inactiva"}</Badge>
                    </Td>
                    <Td className="space-x-2 text-right">
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingId(l.id);
                              setEditName(l.name);
                            }}
                          >
                            Editar
                          </Button>
                          {l.isActive && (
                            <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(l.id)}>
                              Desactivar
                            </Button>
                          )}
                        </>
                      )}
                    </Td>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card title="Precios por producto">
        <Select className="mb-3" value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)}>
          <option value="">Seleccionar lista...</option>
          {priceLists?.data
            .filter((l) => l.isActive)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} {l.name}
              </option>
            ))}
        </Select>
        {selectedListId && (
          <Table>
            <TableHead>
              <tr>
                <Th>Producto</Th>
                <Th>Precio base</Th>
                <Th>Precio en esta lista</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {products?.data.map((p) => {
                const override = overrideFor(p.id);
                return (
                  <TableRow key={p.id}>
                    <Td>{p.name}</Td>
                    <Td>{formatCOP(p.currentPrice)}</Td>
                    <Td>
                      {canManage ? (
                        <Input
                          type="number"
                          defaultValue={override}
                          placeholder="Usa el precio base"
                          className="w-28"
                          key={override}
                          onBlur={(e) => {
                            const price = Number(e.target.value);
                            if (e.target.value && price !== override) setPriceMutation.mutate({ productId: p.id, price });
                          }}
                        />
                      ) : override !== undefined ? (
                        formatCOP(override)
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>
                      {canManage && override !== undefined && (
                        <Button size="sm" variant="secondary" onClick={() => removePriceMutation.mutate(p.id)}>
                          Quitar
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

type Section = "products" | "price-lists";

export function ProductListPage() {
  const [section, setSection] = useState<Section>("products");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Inventario</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Button size="sm" variant={section === "products" ? "primary" : "secondary"} onClick={() => setSection("products")}>
          Productos
        </Button>
        <Button size="sm" variant={section === "price-lists" ? "primary" : "secondary"} onClick={() => setSection("price-lists")}>
          Listas de precios
        </Button>
      </div>

      {section === "products" && <ProductsSection />}
      {section === "price-lists" && <PriceListsSection />}
    </AppLayout>
  );
}
