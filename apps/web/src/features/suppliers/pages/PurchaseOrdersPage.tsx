import { Fragment, useState } from "react";
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
import { listSuppliers, type SupplierRecord } from "../api/supplier.api";
import { listProducts, type ProductListItem } from "../../inventory/api/product.api";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listGoodsReceipts,
  listPurchaseOrders,
  printPurchaseOrderPdf,
  receiveGoods,
  sendPurchaseOrder,
  type PurchaseOrderItemInput,
} from "../api/purchase-order.api";

interface ItemRow extends PurchaseOrderItemInput {
  batchNumber?: string;
  expirationDate?: string;
}

const EMPTY_ITEM: ItemRow = { productId: "", quantity: 1, unitCost: 0 };

const PURCHASE_ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  PARTIALLY_RECEIVED: "Recibida parcial",
  RECEIVED: "Recibida completa",
  CANCELLED: "Anulada",
};

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
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: field === "quantity" || field === "unitCost" ? Number(value) : value } : item)));
  }

  return (
    <Table className="mb-3">
      <TableHead>
        <tr>
          <Th>Producto</Th>
          <Th>Cantidad</Th>
          <Th>Costo unit.</Th>
          {withBatch && <Th>Lote</Th>}
          {withBatch && <Th>Vencimiento</Th>}
        </tr>
      </TableHead>
      <TableBody>
        {items.map((item, i) => (
          <TableRow key={i} className="hover:bg-transparent">
            <Td className="pr-2">
              <Select value={item.productId} onChange={(e) => update(i, "productId", e.target.value)}>
                <option value="">Seleccionar...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} {p.name}
                  </option>
                ))}
              </Select>
            </Td>
            <Td className="pr-2">
              <Input type="number" className="w-20" value={item.quantity} onChange={(e) => update(i, "quantity", e.target.value)} />
            </Td>
            <Td className="pr-2">
              <Input type="number" className="w-24" value={item.unitCost} onChange={(e) => update(i, "unitCost", e.target.value)} />
            </Td>
            {withBatch && (
              <Td className="pr-2">
                <Input className="w-24" value={item.batchNumber ?? ""} onChange={(e) => update(i, "batchNumber", e.target.value)} />
              </Td>
            )}
            {withBatch && (
              <Td>
                <Input type="date" value={item.expirationDate ?? ""} onChange={(e) => update(i, "expirationDate", e.target.value)} />
              </Td>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
  const printMutation = useMutation({ mutationFn: printPurchaseOrderPdf });

  function supplierName(id: string): string {
    return suppliers.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <div className="space-y-6">
      <Card title="Nueva orden de compra">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Select className="mb-3" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">Proveedor...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <ItemsEditor items={items} onChange={setItems} products={products} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
              + Item
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Crear orden
            </Button>
          </div>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(createMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Proveedor</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((po) => (
                <Fragment key={po.id}>
                  <TableRow>
                    <Td className="font-medium text-slate-900">{supplierName(po.supplierId)}</Td>
                    <Td>{formatCOP(po.total)}</Td>
                    <Td>
                      <Badge tone={po.status === "DRAFT" ? "neutral" : "success"}>{PURCHASE_ORDER_STATUS_LABEL[po.status] ?? po.status}</Badge>
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => printMutation.mutate(po.id)}
                        loading={printMutation.isPending && printMutation.variables === po.id}
                      >
                        Imprimir
                      </Button>
                      {po.status === "DRAFT" && (
                        <Button size="sm" onClick={() => sendMutation.mutate(po.id)} loading={sendMutation.isPending}>
                          Enviar
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}>
                        {expandedId === po.id ? "Ocultar" : "Ver items"}
                      </Button>
                    </Td>
                  </TableRow>
                  {expandedId === po.id && detail && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 p-4">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-slate-500">
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
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
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
    <div className="space-y-6">
      <Card title="Registrar recepcion de mercancia">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">Proveedor...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)}>
              <option value="">(sin orden de compra)</option>
              {orders?.data
                .filter((o) => o.status === "SENT" || o.status === "PARTIALLY_RECEIVED")
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {supplierName(o.supplierId)} — {formatCOP(o.total)}
                  </option>
                ))}
            </Select>
          </div>
          <ItemsEditor items={items} onChange={setItems} products={products} withBatch />
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
              + Item
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Registrar recepcion
            </Button>
          </div>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(createMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Proveedor</Th>
                <Th>Fecha</Th>
                <Th>Items</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((gr) => (
                <TableRow key={gr.id}>
                  <Td className="font-medium text-slate-900">{supplierName(gr.supplierId)}</Td>
                  <Td>{gr.createdAt.slice(0, 10)}</Td>
                  <Td>{gr.items.length}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

type Section = "orders" | "receipts";

export function PurchaseOrdersPage() {
  const [section, setSection] = useState<Section>("orders");
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Ordenes de compra</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Button size="sm" variant={section === "orders" ? "primary" : "secondary"} onClick={() => setSection("orders")}>
          Ordenes de compra
        </Button>
        <Button size="sm" variant={section === "receipts" ? "primary" : "secondary"} onClick={() => setSection("receipts")}>
          Recepciones
        </Button>
      </div>

      {section === "orders" && <PurchaseOrdersSection suppliers={suppliers?.data ?? []} products={products?.data ?? []} />}
      {section === "receipts" && <GoodsReceiptsSection suppliers={suppliers?.data ?? []} products={products?.data ?? []} />}
    </AppLayout>
  );
}
