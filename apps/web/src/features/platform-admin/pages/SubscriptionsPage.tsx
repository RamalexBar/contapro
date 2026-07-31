import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import {
  createSubscription,
  listCompanies,
  listPlans,
  listSubscriptions,
  registerSubscriptionPayment,
  type SubscriptionStatus,
} from "../api/saas-admin.api";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: "En prueba",
  ACTIVE: "Activa",
  GRACE_PERIOD: "Periodo de gracia",
  SUSPENDED: "Suspendida",
  CANCELLED: "Cancelada",
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "subscriptions"], queryFn: listSubscriptions });
  const { data: companies } = useQuery({ queryKey: ["saas-admin", "companies"], queryFn: listCompanies });
  const { data: plans } = useQuery({ queryKey: ["saas-admin", "plans"], queryFn: listPlans });

  const [form, setForm] = useState({
    companyId: "",
    planId: "",
    status: "ACTIVE" as SubscriptionStatus,
    billingCycle: "MONTHLY" as "MONTHLY" | "YEARLY",
    startDate: todayStr(),
    currentPeriodEnd: todayStr(),
  });
  const createMutation = useMutation({
    mutationFn: () => createSubscription(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saas-admin", "subscriptions"] }),
  });

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", reference: "" });
  const payMutation = useMutation({
    mutationFn: (id: string) =>
      registerSubscriptionPayment(id, { amount: Number(payForm.amount), method: payForm.method, reference: payForm.reference || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-admin", "subscriptions"] });
      setPayingId(null);
      setPayForm({ amount: "", method: "CASH", reference: "" });
    },
  });

  return (
    <PlatformAdminLayout>
      <h1 className="mb-4 text-lg font-semibold">Suscripciones</h1>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Asignar suscripcion manual</h2>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.companyId}
            onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            required
          >
            <option value="">Empresa...</option>
            {companies?.data.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.companyName}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.planId}
            onChange={(e) => setForm({ ...form, planId: e.target.value })}
            required
          >
            <option value="">Plan...</option>
            {plans?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.billingCycle}
            onChange={(e) => setForm({ ...form, billingCycle: e.target.value as "MONTHLY" | "YEARLY" })}
          >
            <option value="MONTHLY">Mensual</option>
            <option value="YEARLY">Anual</option>
          </select>
          <Input type="date" label="Inicio" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Input
            type="date"
            label="Vence"
            value={form.currentPeriodEnd}
            onChange={(e) => setForm({ ...form, currentPeriodEnd: e.target.value })}
          />
          <Button type="submit" disabled={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Empresa</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Vence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2">{s.companyName}</td>
                <td>{s.planName}</td>
                <td>{STATUS_LABELS[s.status]}</td>
                <td>{s.currentPeriodEnd.slice(0, 10)}</td>
                <td className="text-right">
                  {payingId !== s.id && (
                    <Button variant="secondary" onClick={() => setPayingId(s.id)}>
                      Registrar pago
                    </Button>
                  )}
                  {payingId === s.id && (
                    <span className="inline-flex items-center gap-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-gray-200 px-2 py-1"
                        placeholder="Monto"
                        value={payForm.amount}
                        onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      />
                      <select
                        className="rounded border border-gray-200 px-2 py-1"
                        value={payForm.method}
                        onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                      >
                        <option value="CASH">Efectivo</option>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="CARD">Tarjeta</option>
                      </select>
                      <input
                        className="w-24 rounded border border-gray-200 px-2 py-1"
                        placeholder="Referencia"
                        value={payForm.reference}
                        onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                      />
                      <Button onClick={() => payMutation.mutate(s.id)} disabled={!payForm.amount || payMutation.isPending}>
                        Confirmar
                      </Button>
                      <Button variant="secondary" onClick={() => setPayingId(null)}>
                        Cancelar
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PlatformAdminLayout>
  );
}
