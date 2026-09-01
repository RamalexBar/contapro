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
import { createProduct, deleteProduct, listProducts, updateProduct, updateProductBarcode, updateProductPrice } from "../api/product.api";
import {
  createPriceList,
  deactivatePriceList,
  listPriceLists,
  listProductPrices,
  removeProductPrice,
  setProductPrice,
  updatePriceList,
} from "../api/price-list.api";
import { listCategories } from "../api/category.api";
import { listBrands } from "../api/brand.api";
import { CategoriesSection } from "../components/CategoriesSection";
import { BrandsSection } from "../components/BrandsSection";
import { BranchStockSection } from "../components/BranchStockSection";
import { StockMovementsSection } from "../components/StockMovementsSection";
import { KardexSection } from "../components/KardexSection";

function ProductsSection() {
  const queryClient = useQueryClient();
  const canManagePrice = useAuthStore((s) => s.hasPermission("product.price.update"));
  const canDelete = useAuthStore((s) => s.hasPermission("product.delete"));
  const canCreate = useAuthStore((s) => s.hasPermission("product.create"));
  const canUpdate = useAuthStore((s) => s.hasPermission("product.update"));
  const canUpdateBarcode = useAuthStore((s) => s.hasPermission("product.barcode.update"));

  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: listBrands });

  const [form, setForm] = useState({ sku: "", name: "", currentPrice: "", currentCost: "", barcode: "", categoryId: "", brandId: "" });
  const createMutation = useMutation({
    mutationFn: () =>
      createProduct({
        sku: form.sku,
        name: form.name,
        currentPrice: Number(form.currentPrice),
        currentCost: Number(form.currentCost),
        barcode: form.barcode || undefined,
        categoryId: form.categoryId || undefined,
        brandId: form.brandId || undefined,
        unit: "UN",
        taxRate: 19,
        initialStock: 0,
        minStock: 0,
        maxStock: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setForm({ sku: "", name: "", currentPrice: "", currentCost: "", barcode: "", categoryId: "", brandId: "" });
    },
  });

  const priceMutation = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => updateProductPrice(id, price),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const categoryBrandMutation = useMutation({
    mutationFn: ({ id, categoryId, brandId }: { id: string; categoryId?: string | null; brandId?: string | null }) =>
      updateProduct(id, { categoryId, brandId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const [barcodeDraft, setBarcodeDraft] = useState<Record<string, string>>({});
  const barcodeMutation = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) => updateProductBarcode(id, code),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setBarcodeDraft((prev) => ({ ...prev, [id]: "" }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  function categoryName(categoryId: string | null) {
    return categories?.data.find((c) => c.id === categoryId)?.name ?? "-";
  }
  function brandName(brandId: string | null) {
    return brands?.data.find((b) => b.id === brandId)?.name ?? "-";
  }

  return (
    <div className="space-y-6">
      {canCreate && (
        <Card title="Nuevo producto">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
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
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Sin categoria</option>
              {categories?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
              <option value="">Sin marca</option>
              {brands?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Button type="submit" loading={createMutation.isPending}>
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
                <Th>Categoria</Th>
                <Th>Marca</Th>
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
                  <Td>
                    {canUpdate ? (
                      <Select
                        className="w-32"
                        defaultValue={p.categoryId ?? ""}
                        key={p.categoryId}
                        onChange={(e) => categoryBrandMutation.mutate({ id: p.id, categoryId: e.target.value || null })}
                      >
                        <option value="">Sin categoria</option>
                        {categories?.data.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      categoryName(p.categoryId)
                    )}
                  </Td>
                  <Td>
                    {canUpdate ? (
                      <Select
                        className="w-32"
                        defaultValue={p.brandId ?? ""}
                        key={p.brandId}
                        onChange={(e) => categoryBrandMutation.mutate({ id: p.id, brandId: e.target.value || null })}
                      >
                        <option value="">Sin marca</option>
                        {brands?.data.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      brandName(p.brandId)
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      {p.barcodes.length > 0 && <span>{p.barcodes.join(", ")}</span>}
                      {canUpdateBarcode && (
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder="+ codigo"
                            className="w-24"
                            value={barcodeDraft[p.id] ?? ""}
                            onChange={(e) => setBarcodeDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={barcodeMutation.isPending}
                            disabled={!barcodeDraft[p.id]}
                            onClick={() => barcodeMutation.mutate({ id: p.id, code: barcodeDraft[p.id] ?? "" })}
                          >
                            Agregar
                          </Button>
                        </div>
                      )}
                    </div>
                  </Td>
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

type Section = "products" | "price-lists" | "categories" | "brands" | "branches" | "movements" | "kardex";

const SECTION_LABELS: Record<Section, string> = {
  products: "Productos",
  "price-lists": "Listas de precios",
  categories: "Categorias",
  brands: "Marcas",
  branches: "Sucursales",
  movements: "Movimientos de stock",
  kardex: "Kardex",
};

export function ProductListPage() {
  const [section, setSection] = useState<Section>("products");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Inventario</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(Object.keys(SECTION_LABELS) as Section[]).map((s) => (
          <Button key={s} size="sm" variant={section === s ? "primary" : "secondary"} onClick={() => setSection(s)}>
            {SECTION_LABELS[s]}
          </Button>
        ))}
      </div>

      {section === "products" && <ProductsSection />}
      {section === "price-lists" && <PriceListsSection />}
      {section === "categories" && <CategoriesSection />}
      {section === "brands" && <BrandsSection />}
      {section === "branches" && <BranchStockSection />}
      {section === "movements" && <StockMovementsSection />}
      {section === "kardex" && <KardexSection />}
    </AppLayout>
  );
}
