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
  closeOpportunityAsWon,
  createOpportunity,
  listOpportunities,
  updateOpportunityStage,
  type OpportunityRecord,
} from "../api/opportunity.api";

const OPEN_STAGES = ["PROSPECTO", "CONTACTO", "PROPUESTA", "NEGOCIACION"] as const;
const STAGE_LABELS: Record<string, string> = {
  PROSPECTO: "Prospecto",
  CONTACTO: "Contacto",
  PROPUESTA: "Propuesta",
  NEGOCIACION: "Negociacion",
  GANADA: "Ganada",
  PERDIDA: "Perdida",
};

interface OpportunityLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

export function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = useAuthStore((s) => s.hasPermission("opportunity.manage"));

  const { data, isLoading } = useQuery({ queryKey: ["opportunities"], queryFn: () => listOpportunities() });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled: canManage });

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [lines, setLines] = useState<OpportunityLine[]>([]);
  const [losingId, setLosingId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeInfo, setCloseInfo] = useState<string | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["opportunities"] });
  }

  function customerName(id: string): string {
    return customers?.data.find((c) => c.id === id)?.name ?? id;
  }

  function addLine(product: { id: string; name: string; currentPrice: number }) {
    setLines((prev) => {
      if (prev.some((l) => l.productId === product.id)) return prev;
      return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice: product.currentPrice, discountPercent: 0 }];
    });
  }

  const expectedValue = lines.reduce((sum, l) => sum + Math.round(l.unitPrice * l.quantity * (1 - l.discountPercent / 100) * 100) / 100, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      createOpportunity({
        branchId: user!.branchId!,
        customerId,
        title,
        expectedCloseDate: expectedCloseDate || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
        })),
      }),
    onSuccess: () => {
      invalidate();
      setTitle("");
      setCustomerId("");
      setExpectedCloseDate("");
      setLines([]);
    },
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage, reason }: { id: string; stage: string; reason?: string }) =>
      updateOpportunityStage(id, { stage, lostReason: reason }),
    onSuccess: () => {
      invalidate();
      setLosingId(null);
      setLostReason("");
    },
  });

  const winMutation = useMutation({
    mutationFn: (id: string) => closeOpportunityAsWon(id),
    onSuccess: (result) => {
      invalidate();
      setCloseError(null);
      setCloseInfo(
        result.sale.status === "PENDING_AUTHORIZATION"
          ? `Venta #${result.sale.number} creada, pero el descuento negociado supera el limite del cajero: queda pendiente de autorizacion.`
          : `Venta #${result.sale.number} creada por ${formatCOP(result.sale.total)}.`
      );
    },
    onError: (err: Error) => setCloseError(err.message),
  });

  const opportunities = data?.data ?? [];
  const openOpportunities = opportunities.filter((o) => OPEN_STAGES.includes(o.stage as (typeof OPEN_STAGES)[number]));
  const closedOpportunities = opportunities.filter((o) => o.stage === "GANADA" || o.stage === "PERDIDA");

  function OpportunityCard({ opp }: { opp: OpportunityRecord }) {
    return (
      <div className="mb-2 rounded border border-gray-200 bg-white p-2 text-sm shadow-sm">
        <p className="font-medium text-gray-800">{opp.title}</p>
        <p className="text-xs text-gray-500">{customerName(opp.customerId)}</p>
        <p className="mt-1 font-semibold text-gray-700">{formatCOP(opp.expectedValue)}</p>
        {canManage && (
          <div className="mt-2 space-y-1">
            <select
              className="w-full rounded border border-gray-200 px-1 py-1 text-xs"
              value={opp.stage}
              onChange={(e) => stageMutation.mutate({ id: opp.id, stage: e.target.value })}
            >
              {OPEN_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <Button variant="secondary" className="flex-1 text-xs" onClick={() => setLosingId(opp.id)}>
                Marcar perdida
              </Button>
              <Button className="flex-1 text-xs" disabled={winMutation.isPending} onClick={() => winMutation.mutate(opp.id)}>
                Cerrar ganada
              </Button>
            </div>
            {losingId === opp.id && (
              <div className="flex gap-1">
                <input
                  className="w-full rounded border border-gray-200 px-1 py-1 text-xs"
                  placeholder="Motivo"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                />
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={!lostReason || stageMutation.isPending}
                  onClick={() => stageMutation.mutate({ id: opp.id, stage: "PERDIDA", reason: lostReason })}
                >
                  OK
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Oportunidades</h1>
      <p className="mb-4 text-sm text-gray-500">
        Pipeline de negociacion: mueva una oportunidad entre etapas y cierrela como ganada para
        convertirla automaticamente en una venta (a credito por defecto).
      </p>

      {closeInfo && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <p className="text-sm text-green-800">{closeInfo}</p>
          <button className="mt-1 text-xs text-green-700 hover:underline" onClick={() => setCloseInfo(null)}>
            Cerrar
          </button>
        </Card>
      )}
      {closeError && <p className="mb-4 text-sm text-red-600">{closeError}</p>}

      {canManage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva oportunidad</h2>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Input label="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Cliente</span>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {customers?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Cierre esperado (opcional)"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
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
            <div className="mb-3 space-y-1">
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
                        prev.map((l) => (l.productId === line.productId ? { ...l, quantity: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    value={line.unitPrice}
                    className="w-24 rounded border border-gray-200 px-2 py-1"
                    title="Precio negociado"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, unitPrice: Number(e.target.value) } : l))
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
              <p className="text-sm font-semibold text-gray-700">Valor esperado: {formatCOP(expectedValue)}</p>
            </div>
          )}

          <Button
            disabled={!title || !customerId || lines.length === 0 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Crear oportunidad
          </Button>
          {createMutation.isError && <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>}
        </Card>
      )}

      {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {OPEN_STAGES.map((stage) => (
          <div key={stage} className="rounded bg-gray-100 p-2">
            <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">{STAGE_LABELS[stage]}</h3>
            {openOpportunities
              .filter((o) => o.stage === stage)
              .map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} />
              ))}
          </div>
        ))}
      </div>

      {closedOpportunities.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Ganadas / perdidas</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Titulo</th>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Estado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {closedOpportunities.map((opp) => (
                <tr key={opp.id} className="border-b border-gray-100">
                  <td className="py-2">{opp.title}</td>
                  <td>{customerName(opp.customerId)}</td>
                  <td>{formatCOP(opp.expectedValue)}</td>
                  <td>{STAGE_LABELS[opp.stage]}</td>
                  <td>{opp.lostReason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppLayout>
  );
}
