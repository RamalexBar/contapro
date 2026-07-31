import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listSuppliers, type SupplierRecord } from "../api/supplier.api";
import { listProducts, type ProductListItem } from "../../inventory/api/product.api";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listGoodsReceipts,
  listPurchaseOrders,
  receiveGoods,
  sendPurchaseOrder,
  type PurchaseOrderItemInput,
} from "../api/purchase-order.api";

interface ItemRow extends PurchaseOrderItemInput {
  batchNumber?: string;
  expirationDate?: string;
}

const EMPTY_ITEM: ItemRow = { productId: "", quantity: 1, unitCost: 0 };

function ItemsEditor({
  items,
  onChange,
  products,
  withBatch,
}: {
  items: ItemRow[];
  onChange: (items: ItemRow[]) => void;
  products: ProductListItem[];
  withBatch?: boolean;
}) {
  function update(index: number, field: keyof ItemRow, value: string) {
    onChange(
      items.map((item, i) =>
        i === index
          ? { ...item, [field]: field === "quantity" || field === "unitCost" ? Number(value) : value }
          : item
      )
    );
  }

  return (
    <table className="mb-3 w-full text-left text-sm">
      <thead>
        <tr className="text-gray-500">
          <th className="py-1">Producto</th>
          <th>Cantidad</th>
          <th>Costo unit.</th>
          {withBatch && <th>Lote</th>}
          {withBatch && <th>Vencimiento</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td className="py-1 pr-2">
              <select
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={item.productId}
                onChange={(e) => update(i, "productId", e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} {p.name}
                  </option>
                ))}
              </select>
            </td>
            <td className="pr-2">
              <input
                type="number"
                className="w-20 rounded border border-gray-200 px-2 py-1"
                value={item.quantity}
                onChange={(e) => update(i, "quantity", e.target.value)}
              />
            </td>
            <td className="pr-2">
              <input
                type="number"
                className="w-24 rounded border border-gray-200 px-2 py-1"
                value={item.unitCost}
                onChange={(e) => update(i, "unitCost", e.target.value)}
              />
            </td>
            {withBatch && (
              <td className="pr-2">
                <input
                  className="w-24 rounded border border-gray-200 px-2 py-1"
                  value={item.batchNumber ?? ""}
                  onChange={(e) => update(i, "batchNumber", e.target.value)}
                />
              </td>
            )}
            {withBatch && (
              <td>
                <input
                  type="date"
                  className="rounded border border-gray-200 px-2 py-1"
                  value={item.expirationDate ?? ""}
                  onChange={(e) => update(i, "expirationDate", e.target.value)}
                />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PurchaseOrdersSection({ suppliers, products }: { suppliers: SupplierRecord[]; products: ProductListItem[] }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({ queryKey: ["purchase-orders"], queryFn: listPurchaseOrders });
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: detail } = useQuery({
    queryKey: ["purchase-orders", expandedId],
    queryFn: () => getPurchaseOrder(expandedId as string),
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        branchId: user!.branchId!,
        supplierId,
        items: items.filter((i) => i.productId).map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setSupplierId("");
      setItems([{ ...EMPTY_ITEM }]);
    },
  });

  const sendMutation = useMutation({
    mutationFn: sendPurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  function supplierName(id: string): string {
    return suppliers.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva orden de compra</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <select
            className="mb-3 rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          >
            <option value="">Proveedor...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ItemsEditor items={items} onChange={setItems} products={products} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
              + Item
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Crear orden
            </Button>
          </div>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Proveedor</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((po) => (
              <Fragment key={po.id}>
                <tr className="border-b border-gray-100">
                  <td className="py-2">{supplierName(po.supplierId)}</td>
                  <td>{formatCOP(po.total)}</td>
                  <td>{po.status}</td>
                  <td className="space-x-2 text-right">
                    {po.status === "DRAFT" && (
                      <Button onClick={() => sendMutation.mutate(po.id)} disabled={sendMutation.isPending}>
                        Enviar
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}>
                      {expandedId === po.id ? "Ocultar" : "Ver items"}
                    </Button>
                  </td>
                </tr>
                {expandedId === po.id && detail && (
                  <tr>
                    <td colSpan={4} className="bg-gray-50 p-4">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th>Producto</th>
                            <th>Pedido</th>
                            <th>Recibido</th>
                            <th>Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.items.map((item) => (
                            <tr key={item.id}>
                              <td>{products.find((p) => p.id === item.productId)?.name ?? item.productId}</td>
                              <td>{item.quantity}</td>
                              <td>{item.receivedQuantity}</td>
                              <td>{formatCOP(item.unitCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function GoodsReceiptsSection({ suppliers, products }: { suppliers: SupplierRecord[]; products: ProductListItem[] }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({ queryKey: ["goods-receipts"], queryFn: listGoodsReceipts });
  const { data: orders } = useQuery({ queryKey: ["purchase-orders"], queryFn: listPurchaseOrders });

  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);

  const createMutation = useMutation({
    mutationFn: () =>
      receiveGoods({
        branchId: user!.branchId!,
        supplierId,
        purchaseOrderId: purchaseOrderId || undefined,
        items: items
          .filter((i) => i.productId)
          .map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitCost: i.unitCost,
            batchNumber: i.batchNumber || undefined,
            expirationDate: i.expirationDate || undefined,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setSupplierId("");
      setPurchaseOrderId("");
      setItems([{ ...EMPTY_ITEM }]);
    },
  });

  function supplierName(id: string): string {
    return suppliers.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar recepcion de mercancia</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="mb-3 grid grid-cols-2 gap-3">
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              <option value="">Proveedor...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={purchaseOrderId}
              onChange={(e) => setPurchaseOrderId(e.target.value)}
            >
              <option value="">(sin orden de compra)</option>
              {orders?.data
                .filter((o) => o.status === "SENT" || o.status === "PARTIALLY_RECEIVED")
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {supplierName(o.supplierId)} — {formatCOP(o.total)}
                  </option>
                ))}
            </select>
          </div>
          <ItemsEditor items={items} onChange={setItems} products={products} withBatch />
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
              + Item
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Registrar recepcion
            </Button>
          </div>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Proveedor</th>
              <th>Fecha</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((gr) => (
              <tr key={gr.id} className="border-b border-gray-100">
                <td className="py-2">{supplierName(gr.supplierId)}</td>
                <td>{gr.createdAt.slice(0, 10)}</td>
                <td>{gr.items.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

type Section = "orders" | "receipts";

export function PurchaseOrdersPage() {
  const [section, setSection] = useState<Section>("orders");
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Ordenes de compra</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "orders" ? "primary" : "secondary"} onClick={() => setSection("orders")}>
          Ordenes de compra
        </Button>
        <Button variant={section === "receipts" ? "primary" : "secondary"} onClick={() => setSection("receipts")}>
          Recepciones
        </Button>
      </div>

      {section === "orders" && <PurchaseOrdersSection suppliers={suppliers?.data ?? []} products={products?.data ?? []} />}
      {section === "receipts" && <GoodsReceiptsSection suppliers={suppliers?.data ?? []} products={products?.data ?? []} />}
    </AppLayout>
  );
}
