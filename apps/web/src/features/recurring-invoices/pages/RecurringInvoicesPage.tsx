import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listCustomers } from "../../customers/api/customer.api";
import { listPriceLists } from "../../inventory/api/price-list.api";
import { listProducts } from "../../inventory/api/product.api";
import {
  createRecurringInvoice,
  deactivateRecurringInvoice,
  listRecurringInvoiceRuns,
  listRecurringInvoices,
  type RecurringInvoiceItemRecord,
} from "../api/recurring-invoice.api";

const EMPTY_FORM = { customerId: "", name: "", dayOfMonth: "1", priceListId: "", dueDays: "30" };

function RunHistory({ recurringInvoiceId }: { recurringInvoiceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["recurring-invoice-runs", recurringInvoiceId],
    queryFn: () => listRecurringInvoiceRuns(recurringInvoiceId),
  });

  if (isLoading) return <Spinner label="Cargando historial..." />;
  if (!data?.data.length) return <p className="text-sm text-slate-400">Todavia no se ha ejecutado.</p>;

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>Fecha</Th>
          <Th>Resultado</Th>
          <Th>Detalle</Th>
        </tr>
      </TableHead>
      <TableBody>
        {data.data.map((run) => (
          <TableRow key={run.id}>
            <Td>{run.runDate.slice(0, 10)}</Td>
            <Td>
              <Badge tone={run.status === "SUCCESS" ? "success" : "danger"}>{run.status === "SUCCESS" ? "Exitosa" : "Fallida"}</Badge>
            </Td>
            <Td>{run.status === "SUCCESS" ? `Venta ${run.saleId}` : run.errorMessage}</Td>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RecurringInvoicesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = useAuthStore((s) => s.hasPermission("recurring-invoice.manage"));

  const { data, isLoading } = useQuery({ queryKey: ["recurring-invoices"], queryFn: listRecurringInvoices });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });
  const { data: priceLists } = useQuery({ queryKey: ["price-lists"], queryFn: listPriceLists });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  const activePriceLists = priceLists?.data.filter((pl) => pl.isActive) ?? [];

  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<RecurringInvoiceItemRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function customerName(id: string): string {
    return customers?.data.find((c) => c.id === id)?.name ?? id;
  }
  function productName(id: string): string {
    return products?.data.find((p) => p.id === id)?.name ?? id;
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createRecurringInvoice({
        customerId: form.customerId,
        branchId: user!.branchId!,
        name: form.name,
        dayOfMonth: Number(form.dayOfMonth),
        priceListId: form.priceListId || undefined,
        dueDays: Number(form.dueDays),
        items,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      setForm(EMPTY_FORM);
      setItems([]);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateRecurringInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] }),
  });

  function addItem() {
    const first = products?.data[0];
    if (!first) return;
    setItems((prev) => [...prev, { productId: first.id, quantity: 1 }]);
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Facturacion recurrente</h1>
      <p className="mb-4 text-sm text-slate-500">
        Plantillas que generan automaticamente una venta a credito (con su factura electronica) el
        dia del mes indicado, sin necesidad de crearla a mano cada vez. El precio se toma vigente
        al momento de facturar (segun la lista de precios asignada, si tiene una).
      </p>

      {canManage && (
        <Card title="Nueva plantilla" className="mb-6">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input
                placeholder="Nombre (ej. Mantenimiento mensual)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Cliente...</option>
                {customers?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                max={28}
                placeholder="Dia del mes (1-28)"
                value={form.dayOfMonth}
                onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                required
              />
              <Input
                type="number"
                min={1}
                placeholder="Dias de plazo"
                value={form.dueDays}
                onChange={(e) => setForm({ ...form, dueDays: e.target.value })}
                required
              />
              <Select value={form.priceListId} onChange={(e) => setForm({ ...form, priceListId: e.target.value })}>
                <option value="">Precio base (sin lista)</option>
                {activePriceLists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">Productos</h3>
                <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={addItem}>
                  + agregar producto
                </button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="mb-2 flex items-center gap-2 text-sm">
                  <Select
                    className="flex-1"
                    value={item.productId}
                    onChange={(e) =>
                      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, productId: e.target.value } : it)))
                    }
                  >
                    {products?.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={item.quantity}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it, idx) => (idx === i ? { ...it, quantity: Number(e.target.value) } : it))
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-danger-600 hover:underline"
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-slate-400">Agrega al menos un producto</p>}
            </div>

            <Button type="submit" disabled={items.length === 0} loading={createMutation.isPending}>
              Crear plantilla
            </Button>
            {createMutation.isError && (
              <Alert tone="danger">{(createMutation.error as Error).message}</Alert>
            )}
          </form>
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="No hay plantillas todavia." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Nombre</Th>
                <Th>Cliente</Th>
                <Th>Dia</Th>
                <Th>Proxima ejecucion</Th>
                <Th>Ultima ejecucion</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((ri) => (
                <Fragment key={ri.id}>
                  <TableRow>
                    <Td>{ri.name}</Td>
                    <Td>{customerName(ri.customerId)}</Td>
                    <Td>{ri.dayOfMonth}</Td>
                    <Td>{ri.nextRunDate.slice(0, 10)}</Td>
                    <Td>{ri.lastRunDate ? ri.lastRunDate.slice(0, 10) : "-"}</Td>
                    <Td>
                      <Badge tone={ri.isActive ? "success" : "neutral"}>{ri.isActive ? "Activa" : "Inactiva"}</Badge>
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() => setExpandedId(expandedId === ri.id ? null : ri.id)}
                        >
                          {expandedId === ri.id ? "Ocultar historial" : "Ver historial"}
                        </button>
                        {canManage && ri.isActive && (
                          <Button size="sm" variant="secondary" onClick={() => deactivateMutation.mutate(ri.id)}>
                            Desactivar
                          </Button>
                        )}
                      </span>
                    </Td>
                  </TableRow>
                  {expandedId === ri.id && (
                    <TableRow>
                      <Td colSpan={7} className="bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-medium text-slate-600">
                          Productos: {ri.items.map((it) => `${productName(it.productId)} x${it.quantity}`).join(", ")}
                        </p>
                        <RunHistory recurringInvoiceId={ri.id} />
                      </Td>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
