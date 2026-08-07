import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
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
      <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm">
        <p className="font-medium text-slate-800">{opp.title}</p>
        <p className="text-xs text-slate-500">{customerName(opp.customerId)}</p>
        <p className="mt-1 font-semibold text-slate-700">{formatCOP(opp.expectedValue)}</p>
        {canManage && (
          <div className="mt-2 space-y-1">
            <Select
              className="text-xs"
              value={opp.stage}
              onChange={(e) => stageMutation.mutate({ id: opp.id, stage: e.target.value })}
            >
              {OPEN_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={() => setLosingId(opp.id)}>
                Marcar perdida
              </Button>
              <Button size="sm" className="flex-1 text-xs" loading={winMutation.isPending} onClick={() => winMutation.mutate(opp.id)}>
                Cerrar ganada
              </Button>
            </div>
            {losingId === opp.id && (
              <div className="flex gap-1">
                <Input
                  className="text-xs"
                  placeholder="Motivo"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  disabled={!lostReason}
                  loading={stageMutation.isPending}
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
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Oportunidades</h1>
      <p className="mb-4 text-sm text-slate-500">
        Pipeline de negociacion: mueva una oportunidad entre etapas y cierrela como ganada para
        convertirla automaticamente en una venta (a credito por defecto).
      </p>

      {closeInfo && (
        <Alert tone="success" className="mb-4">
          {closeInfo}
          <button className="ml-2 text-xs underline" onClick={() => setCloseInfo(null)}>
            Cerrar
          </button>
        </Alert>
      )}
      {closeError && (
        <Alert tone="danger" className="mb-4">
          {closeError}
        </Alert>
      )}

      {canManage && (
        <Card title="Nueva oportunidad" className="mb-6">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Input label="Titulo" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select label="Cliente" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {customers?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
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
                className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
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
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    className="w-16"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, quantity: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    value={line.unitPrice}
                    className="w-24"
                    title="Precio negociado"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, unitPrice: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-xs text-danger-600"
                    onClick={() => setLines((prev) => prev.filter((l) => l.productId !== line.productId))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <p className="text-sm font-semibold text-slate-700">Valor esperado: {formatCOP(expectedValue)}</p>
            </div>
          )}

          <Button
            disabled={!title || !customerId || lines.length === 0}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Crear oportunidad
          </Button>
          {createMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(createMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      {isLoading && <Spinner />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {OPEN_STAGES.map((stage) => (
          <div key={stage} className="rounded-lg bg-slate-100 p-2">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">{STAGE_LABELS[stage]}</h3>
            {openOpportunities
              .filter((o) => o.stage === stage)
              .map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} />
              ))}
          </div>
        ))}
      </div>

      {closedOpportunities.length > 0 && (
        <Card title="Ganadas / perdidas" noPadding className="mt-6">
          <Table>
            <TableHead>
              <tr>
                <Th>Titulo</Th>
                <Th>Cliente</Th>
                <Th>Valor</Th>
                <Th>Estado</Th>
                <Th>Motivo</Th>
              </tr>
            </TableHead>
            <TableBody>
              {closedOpportunities.map((opp) => (
                <TableRow key={opp.id}>
                  <Td>{opp.title}</Td>
                  <Td>{customerName(opp.customerId)}</Td>
                  <Td>{formatCOP(opp.expectedValue)}</Td>
                  <Td>{STAGE_LABELS[opp.stage]}</Td>
                  <Td>{opp.lostReason ?? "-"}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppLayout>
  );
}
