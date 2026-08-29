import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { ApiError } from "../../../lib/api-client";
import {
  createOwnCheckout,
  disableAutoRenew,
  getOwnSubscription,
  savePaymentSource,
  type PlanRecord,
} from "../api/billing.api";
import { fetchAcceptanceToken, isWompiConfigured, tokenizeCard, WompiError } from "../lib/wompi";

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

/** Numero de tarjeta agrupado en bloques de 4 mientras se escribe -- solo formato visual, el
 * numero real (sin espacios) sale de acá mismo en handleSubmit via .replace(/\s+/g, ""). */
function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => String(CURRENT_YEAR + i).slice(-2));

/** Formulario de tarjeta para activar cobro automatico: tokeniza directo contra la API publica de
 * Wompi desde el navegador (fetchAcceptanceToken/tokenizeCard, ver features/billing/lib/wompi.ts)
 * -- el numero/cvc de la tarjeta NUNCA se envian a nuestro backend, solo el token que devuelve
 * Wompi. Separado de "Pagar ahora" (que sigue siendo el link de checkout redirigido) porque
 * activar renovacion automatica es una accion aparte, disponible en cualquier estado de la
 * suscripcion (no solo TRIALING). */
function AutoRenewCard({ subscription, customerEmail }: { subscription: SubscriptionRecordLike; customerEmail: string | undefined }) {
  const queryClient = useQueryClient();
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expMonth, setExpMonth] = useState<string>(MONTHS[0] ?? "01");
  const [expYear, setExpYear] = useState<string>(YEARS[0] ?? String(CURRENT_YEAR).slice(-2));
  const [cvc, setCvc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customerEmail) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const acceptanceToken = await fetchAcceptanceToken();
      const cardToken = await tokenizeCard({ number: cardNumber, cvc, expMonth, expYear, cardHolder });
      await savePaymentSource({ cardToken, customerEmail, acceptanceToken });
      await queryClient.invalidateQueries({ queryKey: ["own-subscription"] });
      setCardNumber("");
      setCardHolder("");
      setCvc("");
    } catch (err) {
      setFormError(err instanceof WompiError || err instanceof ApiError ? err.message : "No se pudo activar el cobro automatico");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    setFormError(null);
    setDisabling(true);
    try {
      await disableAutoRenew();
      await queryClient.invalidateQueries({ queryKey: ["own-subscription"] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo cancelar la renovacion automatica");
    } finally {
      setDisabling(false);
    }
  }

  if (!isWompiConfigured()) return null;

  return (
    <Card title="Renovacion automatica" className="mb-6">
      {subscription.autoRenew ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Badge tone="success">Activa</Badge>
            <span>
              {subscription.cardBrand ?? "Tarjeta"} terminada en {subscription.cardLastFour ?? "----"}
            </span>
          </div>
          <Button variant="secondary" size="sm" loading={disabling} onClick={handleDisable}>
            Cancelar renovacion automatica
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-slate-500">
            Guarda una tarjeta para que tu suscripcion se renueve sola cada periodo, sin tener que volver a pagar
            manualmente.
          </p>
          <Input
            label="Numero de tarjeta"
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            required
          />
          <Input
            label="Nombre en la tarjeta"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Mes</span>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value)}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Año</span>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={expYear}
                onChange={(e) => setExpYear(e.target.value)}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <Input label="CVC" inputMode="numeric" maxLength={4} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))} required />
          </div>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Button type="submit" loading={submitting} disabled={!customerEmail}>
            Activar renovacion automatica
          </Button>
        </form>
      )}
    </Card>
  );
}

interface SubscriptionRecordLike {
  autoRenew: boolean;
  cardLastFour: string | null;
  cardBrand: string | null;
}

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

          {data.plan.code !== "TRIAL" && <AutoRenewCard subscription={data.subscription} customerEmail={user?.email} />}

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
