import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
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
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Suscripciones</h1>

      <Card title="Asignar suscripcion manual" className="mb-6">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required>
            <option value="">Empresa...</option>
            {companies?.data.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.companyName}
              </option>
            ))}
          </Select>
          <Select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} required>
            <option value="">Plan...</option>
            {plans?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as "MONTHLY" | "YEARLY" })}>
            <option value="MONTHLY">Mensual</option>
            <option value="YEARLY">Anual</option>
          </Select>
          <Input type="date" label="Inicio" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Input
            type="date"
            label="Vence"
            value={form.currentPeriodEnd}
            onChange={(e) => setForm({ ...form, currentPeriodEnd: e.target.value })}
          />
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

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Empresa</Th>
                <Th>Plan</Th>
                <Th>Estado</Th>
                <Th>Vence</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((s) => (
                <TableRow key={s.id}>
                  <Td>{s.companyName}</Td>
                  <Td>{s.planName}</Td>
                  <Td>{STATUS_LABELS[s.status]}</Td>
                  <Td>{s.currentPeriodEnd.slice(0, 10)}</Td>
                  <Td className="text-right">
                    {payingId !== s.id && (
                      <Button size="sm" variant="secondary" onClick={() => setPayingId(s.id)}>
                        Registrar pago
                      </Button>
                    )}
                    {payingId === s.id && (
                      <span className="inline-flex items-center gap-2">
                        <Input
                          type="number"
                          className="w-24"
                          placeholder="Monto"
                          value={payForm.amount}
                          onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                        />
                        <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                          <option value="CASH">Efectivo</option>
                          <option value="TRANSFER">Transferencia</option>
                          <option value="CARD">Tarjeta</option>
                        </Select>
                        <Input
                          className="w-24"
                          placeholder="Referencia"
                          value={payForm.reference}
                          onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                        />
                        <Button size="sm" disabled={!payForm.amount} loading={payMutation.isPending} onClick={() => payMutation.mutate(s.id)}>
                          Confirmar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setPayingId(null)}>
                          Cancelar
                        </Button>
                      </span>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PlatformAdminLayout>
  );
}
