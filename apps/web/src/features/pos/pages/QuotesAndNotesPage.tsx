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

export function QuotesAndNotesPage() {
  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Cotizaciones y notas</h1>
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
    </AppLayout>
  );
}
