import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listProducts } from "../../inventory/api/product.api";
import { listCustomers } from "../../customers/api/customer.api";
import {
  createCreditNote,
  createDebitNote,
  createQuote,
  listCreditNotes,
  listDebitNotes,
  listQuotes,
} from "../api/notes.api";
import { getSale, listSales } from "../api/sale.api";
import { createReturn, listReturns, type RefundMethod } from "../api/return.api";

const RETURNABLE_SALE_STATUSES = new Set(["COMPLETED", "RETURNED_PARTIAL"]);

interface QuoteLine {
  productId: string;
  name: string;
  quantity: number;
}

function QuoteSection() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canCreate = useAuthStore((s) => s.hasPermission("quote.create"));
  const canRead = useAuthStore((s) => s.hasPermission("sale.read"));

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled: canCreate });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
    enabled: canCreate,
  });
  const { data: quotes } = useQuery({ queryKey: ["quotes"], queryFn: listQuotes, enabled: canRead });

  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([]);

  function addLine(product: { id: string; name: string }) {
    setLines((prev) => {
      if (prev.some((l) => l.productId === product.id)) return prev;
      return [...prev, { productId: product.id, name: product.name, quantity: 1 }];
    });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createQuote({
        branchId: user!.branchId!,
        customerId: customerId || undefined,
        validUntil: new Date(validUntil),
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, discountPercent: 0 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setLines([]);
      setValidUntil("");
    },
  });

  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Cotizaciones</h2>
      {canCreate && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Cliente (opcional)</span>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Sin cliente</option>
                {customers?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Valida hasta" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {products?.data.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addLine(p)}
                className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
              >
                + {p.name}
              </button>
            ))}
          </div>

          {lines.length > 0 && (
            <div className="space-y-1">
              {lines.map((line) => (
                <div key={line.productId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{line.name}</span>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    className="w-16 rounded border border-gray-200 px-2 py-1"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.productId === line.productId ? { ...l, quantity: Number(e.target.value) } : l
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() => setLines((prev) => prev.filter((l) => l.productId !== line.productId))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            disabled={lines.length === 0 || !validUntil || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Crear cotizacion
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {canRead && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Estado</th>
              <th>Subtotal</th>
              <th>Total</th>
              <th>Valida hasta</th>
            </tr>
          </thead>
          <tbody>
            {quotes?.data.map((q) => (
              <tr key={q.id} className="border-b border-gray-100">
                <td className="py-2">{q.status}</td>
                <td>{formatCOP(q.subtotal)}</td>
                <td>{formatCOP(q.total)}</td>
                <td>{q.validUntil.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function NoteSection({
  title,
  createPermission,
  createFn,
  listFn,
  queryKey,
}: {
  title: string;
  createPermission: string;
  createFn: (input: { branchId: string; customerId: string; saleId?: string; reason: string; amount: number }) => Promise<unknown>;
  listFn: () => Promise<{ data: { id: string; amount: number; reason: string; status: string; createdAt: string }[] }>;
  queryKey: string;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canCreate = useAuthStore((s) => s.hasPermission(createPermission));
  const canRead = useAuthStore((s) => s.hasPermission("sale.read"));

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
    enabled: canCreate,
  });
  const { data: notes } = useQuery({ queryKey: [queryKey], queryFn: listFn, enabled: canRead });

  const [customerId, setCustomerId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        branchId: user!.branchId!,
        customerId,
        saleId: saleId || undefined,
        reason,
        amount: Number(amount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setSaleId("");
      setReason("");
      setAmount("");
    },
  });

  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">{title}</h2>
      {canCreate && (
        <form
          className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Cliente</span>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Seleccionar...</option>
              {customers?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Input placeholder="ID de venta (opcional)" value={saleId} onChange={(e) => setSaleId(e.target.value)} />
          <Input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required />
          <Input
            placeholder="Monto"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Button type="submit" disabled={createMutation.isPending}>
            Emitir
          </Button>
          {createMutation.isError && (
            <p className="col-span-full text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </form>
      )}
      {canRead && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Motivo</th>
              <th>Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {notes?.data.map((n) => (
              <tr key={n.id} className="border-b border-gray-100">
                <td className="py-2">{n.reason}</td>
                <td>{formatCOP(n.amount)}</td>
                <td>{n.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ReturnSection() {
  const queryClient = useQueryClient();
  const canCreate = useAuthStore((s) => s.hasPermission("return.create"));
  const canRead = useAuthStore((s) => s.hasPermission("sale.read"));

  const { data: sales } = useQuery({ queryKey: ["sales"], queryFn: listSales, enabled: canCreate });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled: canCreate });
  const { data: allReturns } = useQuery({ queryKey: ["returns"], queryFn: () => listReturns(), enabled: canRead });

  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});

  const { data: sale } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: canCreate && Boolean(saleId),
  });
  const { data: saleReturns } = useQuery({
    queryKey: ["returns", saleId],
    queryFn: () => listReturns(saleId),
    enabled: canCreate && Boolean(saleId),
  });

  const returnableSales = (sales?.data ?? []).filter((s) => RETURNABLE_SALE_STATUSES.has(s.status));
  const productName = (id: string) => products?.data.find((p) => p.id === id)?.name ?? id;

  const alreadyReturnedByItem = new Map<string, number>();
  for (const ret of saleReturns?.data ?? []) {
    for (const item of ret.items) {
      alreadyReturnedByItem.set(item.saleItemId, (alreadyReturnedByItem.get(item.saleItemId) ?? 0) + item.quantity);
    }
  }

  function selectSale(id: string) {
    setSaleId(id);
    setQuantities({});
    setRestock({});
  }

  const hasItemsToReturn = Object.values(quantities).some((qty) => qty > 0);

  const createMutation = useMutation({
    mutationFn: () =>
      createReturn({
        saleId,
        reason,
        refundMethod,
        items: Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([saleItemId, qty]) => ({ saleItemId, quantity: qty, restockedToBranch: restock[saleItemId] ?? true })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["returns", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setReason("");
      setQuantities({});
      setRestock({});
    },
  });

  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Devoluciones</h2>
      {canCreate && (
        <div className="mb-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Venta</span>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto"
              value={saleId}
              onChange={(e) => selectSale(e.target.value)}
            >
              <option value="">Seleccionar venta...</option>
              {returnableSales.map((s) => (
                <option key={s.id} value={s.id}>
                  Venta #{s.number} - {formatCOP(s.total)} - {s.status}
                </option>
              ))}
            </select>
          </label>

          {sale && (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2">Producto</th>
                    <th>Vendido</th>
                    <th>Ya devuelto</th>
                    <th>Cantidad a devolver</th>
                    <th>Reponer a inventario</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => {
                    const alreadyReturned = alreadyReturnedByItem.get(item.id) ?? 0;
                    const remaining = item.quantity - alreadyReturned;
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2">{productName(item.productId)}</td>
                        <td>{item.quantity}</td>
                        <td>{alreadyReturned}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            disabled={remaining <= 0}
                            value={quantities[item.id] ?? 0}
                            className="w-20 rounded border border-gray-200 px-2 py-1 disabled:bg-gray-100"
                            onChange={(e) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [item.id]: Math.max(0, Math.min(Number(e.target.value), remaining)),
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={restock[item.id] ?? true}
                            disabled={remaining <= 0}
                            onChange={(e) => setRestock((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex flex-wrap items-end gap-3">
                <Input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required />
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Medio de reembolso</span>
                  <select
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CREDIT_TO_ACCOUNT">Abono a cuenta del cliente</option>
                  </select>
                </label>
                <Button
                  disabled={!hasItemsToReturn || !reason || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  Registrar devolucion
                </Button>
              </div>
              {createMutation.isError && (
                <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
              )}
            </>
          )}
        </div>
      )}

      {canRead && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Motivo</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {allReturns?.data.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="py-2">{r.reason}</td>
                <td>{formatCOP(r.total)}</td>
                <td>{r.status}</td>
                <td>{r.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function QuotesAndNotesPage() {
  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Cotizaciones, notas y devoluciones</h1>
      <QuoteSection />
      <NoteSection
        title="Notas credito"
        createPermission="creditnote.create"
        createFn={createCreditNote}
        listFn={listCreditNotes}
        queryKey="credit-notes"
      />
      <NoteSection
        title="Notas debito"
        createPermission="debitnote.create"
        createFn={createDebitNote}
        listFn={listDebitNotes}
        queryKey="debit-notes"
      />
      <ReturnSection />
    </AppLayout>
  );
}
