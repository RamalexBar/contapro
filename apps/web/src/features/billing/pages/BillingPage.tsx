import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { ApiError } from "../../../lib/api-client";
import { createOwnCheckout, getOwnSubscription, type PlanRecord } from "../api/billing.api";

const STATUS_LABELS: Record<string, string> = {
  TRIALING: "Periodo de prueba",
  ACTIVE: "Activa",
  GRACE_PERIOD: "Periodo de gracia (pago vencido)",
  SUSPENDED: "Suspendida",
  CANCELLED: "Cancelada",
};

const STATUS_TONES: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  TRIALING: "info",
  ACTIVE: "success",
  GRACE_PERIOD: "warning",
  SUSPENDED: "danger",
  CANCELLED: "neutral",
};

export function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["own-subscription"], queryFn: getOwnSubscription });
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(planId?: string) {
    if (!user?.email) return;
    setError(null);
    setPayingPlanId(planId ?? "current");
    try {
      const result = await createOwnCheckout({
        customerEmail: user.email,
        redirectUrl: `${window.location.origin}/billing`,
        planId,
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo generar el link de pago");
      setPayingPlanId(null);
    }
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Mi suscripcion</h1>

      {isLoading && <Spinner />}

      {data && (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Plan actual</p>
                <p className="text-lg font-semibold text-slate-900">{data.plan.name}</p>
              </div>
              <Badge tone={STATUS_TONES[data.subscription.status] ?? "neutral"}>
                {STATUS_LABELS[data.subscription.status] ?? data.subscription.status}
              </Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Ciclo</dt>
                <dd className="font-medium">{data.subscription.billingCycle === "YEARLY" ? "Anual" : "Mensual"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Vence</dt>
                <dd className="font-medium">{data.subscription.currentPeriodEnd.slice(0, 10)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Precio</dt>
                <dd className="font-medium">
                  {formatCOP(data.subscription.billingCycle === "YEARLY" ? data.plan.priceYearly : data.plan.priceMonthly)}
                </dd>
              </div>
            </dl>

            {data.plan.code !== "TRIAL" && (
              <div className="mt-4">
                <Button loading={payingPlanId === "current"} disabled={payingPlanId !== null} onClick={() => pay()}>
                  Pagar ahora
                </Button>
              </div>
            )}
            {error && (
              <Alert tone="danger" className="mt-3">
                {error}
              </Alert>
            )}
          </Card>

          {/* Mientras la suscripcion siga en TRIALING se puede elegir/cambiar de plan libremente,
              sin importar cual quedo asignado de un intento anterior -- antes esto se gateaba por
              `data.plan.code === "TRIAL"`, que dejaba de ser cierto apenas alguien elegia un plan
              pago (createOwnCheckout cambia Subscription.planId ANTES de cobrar, para que el
              monto del checkout sea el correcto), asi que si esa persona no llegaba a pagar
              quedaba con un solo boton "Pagar ahora" y sin forma de volver a la lista. */}
          {data.subscription.status === "TRIALING" && data.availablePlans.length > 0 && (
            <Card title="Elegi un plan para empezar a pagar">
              <div className="grid gap-4 sm:grid-cols-3">
                {data.availablePlans.map((plan: PlanRecord) => {
                  const isSelected = plan.id === data.plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`rounded-lg border p-4 ${isSelected ? "border-brand-400 bg-brand-50" : "border-slate-200"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{plan.name}</p>
                        {isSelected && <Badge tone="info">Seleccionado</Badge>}
                      </div>
                      <p className="mt-1 text-xl font-bold text-brand-700">{formatCOP(plan.priceMonthly)}</p>
                      <p className="text-xs text-slate-500">/mes</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Hasta {plan.maxBranches} sucursal{plan.maxBranches === 1 ? "" : "es"}, {plan.maxUsers} usuarios
                      </p>
                      <Button
                        variant="secondary"
                        className="mt-3 w-full"
                        loading={payingPlanId === plan.id}
                        disabled={payingPlanId !== null}
                        onClick={() => pay(plan.id)}
                      >
                        {isSelected ? "Pagar este plan" : "Cambiar a este plan"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {!isLoading && !data && (
        <Card>
          <p className="text-sm text-slate-500">
            No se encontro ninguna suscripcion para tu empresa.{" "}
            <button className="text-brand-700 hover:underline" onClick={() => refetch()}>
              Reintentar
            </button>
          </p>
        </Card>
      )}
    </AppLayout>
  );
}
