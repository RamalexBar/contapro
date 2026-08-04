import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
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

const STATUS_COLORS: Record<string, string> = {
  TRIALING: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  GRACE_PERIOD: "bg-amber-100 text-amber-800",
  SUSPENDED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-700",
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
      <h1 className="mb-4 text-lg font-semibold">Mi suscripcion</h1>

      {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}

      {data && (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Plan actual</p>
                <p className="text-lg font-semibold text-gray-900">{data.plan.name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[data.subscription.status] ?? "bg-gray-100 text-gray-700"}`}>
                {STATUS_LABELS[data.subscription.status] ?? data.subscription.status}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-gray-500">Ciclo</dt>
                <dd className="font-medium">{data.subscription.billingCycle === "YEARLY" ? "Anual" : "Mensual"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Vence</dt>
                <dd className="font-medium">{data.subscription.currentPeriodEnd.slice(0, 10)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Precio</dt>
                <dd className="font-medium">
                  {formatCOP(data.subscription.billingCycle === "YEARLY" ? data.plan.priceYearly : data.plan.priceMonthly)}
                </dd>
              </div>
            </dl>

            {data.plan.code !== "TRIAL" && (
              <div className="mt-4">
                <Button disabled={payingPlanId !== null} onClick={() => pay()}>
                  {payingPlanId === "current" ? "Generando link..." : "Pagar ahora"}
                </Button>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </Card>

          {data.plan.code === "TRIAL" && data.availablePlans.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Elegi un plan para empezar a pagar</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {data.availablePlans.map((plan: PlanRecord) => (
                  <div key={plan.id} className="rounded-lg border border-gray-200 p-4">
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="mt-1 text-xl font-bold text-brand-700">{formatCOP(plan.priceMonthly)}</p>
                    <p className="text-xs text-gray-500">/mes</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Hasta {plan.maxBranches} sucursal{plan.maxBranches === 1 ? "" : "es"}, {plan.maxUsers} usuarios
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      disabled={payingPlanId !== null}
                      onClick={() => pay(plan.id)}
                    >
                      {payingPlanId === plan.id ? "Generando link..." : "Elegir este plan"}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {!isLoading && !data && (
        <Card>
          <p className="text-sm text-gray-500">
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
