import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import {
  createApiKey,
  createWebhookSubscription,
  deactivateApiKey,
  deactivateWebhookSubscription,
  listApiKeys,
  listWebhookDeliveries,
  listWebhookSubscriptions,
  resendWebhookDelivery,
  type CreateApiKeyResult,
  type CreateWebhookSubscriptionResult,
} from "../api/integrations.api";

const API_SCOPE_OPTIONS = [
  { code: "product.read", label: "Ver productos" },
  { code: "customer.read", label: "Ver clientes" },
  { code: "customer.manage", label: "Crear clientes" },
  { code: "sale.read", label: "Ver ventas" },
  { code: "sale.create", label: "Crear ventas" },
];

const WEBHOOK_EVENT_OPTIONS = [{ code: "sale.created", label: "Venta creada" }];

function ApiKeysSection() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = useAuthStore((s) => s.hasPermission("api-key.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys });

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [justCreated, setJustCreated] = useState<CreateApiKeyResult | null>(null);

  const availableScopes = API_SCOPE_OPTIONS.filter((s) => user?.permissions.includes(s.code));

  const createMutation = useMutation({
    mutationFn: () => createApiKey({ name, scopes }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setJustCreated(result);
      setName("");
      setScopes([]);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function toggleScope(code: string) {
    setScopes((prev) => (prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]));
  }

  return (
    <>
      {justCreated && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <p className="mb-1 text-sm font-semibold text-blue-900">
            API key creada: {justCreated.name}
          </p>
          <p className="mb-2 text-sm text-blue-800">
            Guárdala ahora — no se puede volver a mostrar. Úsala en el header{" "}
            <code>Authorization: Bearer &lt;key&gt;</code> contra <code>/api/public/v1/...</code>.
          </p>
          <code className="block break-all rounded bg-white px-3 py-2 text-sm">{justCreated.key}</code>
          <button className="mt-2 text-xs text-blue-600 hover:underline" onClick={() => setJustCreated(null)}>
            Ya la guardé, cerrar
          </button>
        </Card>
      )}

      {canManage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva API key</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input placeholder="Nombre (ej. Integracion Shopify)" value={name} onChange={(e) => setName(e.target.value)} required />
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Scopes</p>
              <div className="flex flex-wrap gap-3">
                {availableScopes.map((s) => (
                  <label key={s.code} className="flex items-center gap-1 text-sm text-gray-700">
                    <input type="checkbox" checked={scopes.includes(s.code)} onChange={() => toggleScope(s.code)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={scopes.length === 0 || createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
        </Card>
      )}

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Nombre</th>
              <th>Prefijo</th>
              <th>Scopes</th>
              <th>Ultimo uso</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((k) => (
              <tr key={k.id} className="border-b border-gray-100">
                <td className="py-2">{k.name}</td>
                <td>
                  <code>{k.keyPrefix}...</code>
                </td>
                <td className="text-xs">{k.scopes.join(", ")}</td>
                <td>{k.lastUsedAt ? k.lastUsedAt.slice(0, 10) : "Nunca"}</td>
                <td className={k.isActive ? "text-green-600" : "text-gray-400"}>{k.isActive ? "Activa" : "Revocada"}</td>
                <td className="text-right">
                  {canManage && k.isActive && (
                    <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(k.id)}>
                      Revocar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay API keys todavia.</p>}
      </Card>
    </>
  );
}

function DeliveryHistory({ webhookSubscriptionId }: { webhookSubscriptionId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["webhook-deliveries", webhookSubscriptionId],
    queryFn: () => listWebhookDeliveries(webhookSubscriptionId),
  });

  const resendMutation = useMutation({
    mutationFn: resendWebhookDelivery,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-deliveries", webhookSubscriptionId] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Cargando historial...</p>;
  if (!data?.data.length) return <p className="text-sm text-gray-400">Todavia no se ha disparado ningun evento.</p>;

  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-gray-200 text-gray-500">
          <th className="py-1">Fecha</th>
          <th>Evento</th>
          <th>Resultado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.data.map((d) => (
          <tr key={d.id} className="border-b border-gray-100">
            <td className="py-1">{d.attemptedAt.slice(0, 19).replace("T", " ")}</td>
            <td>{d.eventType}</td>
            <td className={d.success ? "text-green-600" : "text-red-600"}>
              {d.success ? `OK (${d.responseStatus})` : d.errorMessage ?? `Fallo (${d.responseStatus ?? "sin respuesta"})`}
            </td>
            <td className="text-right">
              {!d.success && (
                <button
                  className="text-blue-600 hover:underline"
                  disabled={resendMutation.isPending}
                  onClick={() => resendMutation.mutate(d.id)}
                >
                  Reenviar
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WebhooksSection() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("webhook.manage"));
  const { data, isLoading } = useQuery({ queryKey: ["webhook-subscriptions"], queryFn: listWebhookSubscriptions });

  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [justCreated, setJustCreated] = useState<CreateWebhookSubscriptionResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createWebhookSubscription({ url, eventTypes }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
      setJustCreated(result);
      setUrl("");
      setEventTypes([]);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateWebhookSubscription,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] }),
  });

  function toggleEvent(code: string) {
    setEventTypes((prev) => (prev.includes(code) ? prev.filter((e) => e !== code) : [...prev, code]));
  }

  return (
    <>
      {justCreated && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <p className="mb-1 text-sm font-semibold text-blue-900">Webhook creado apuntando a {justCreated.url}</p>
          <p className="mb-2 text-sm text-blue-800">
            Guarda este secreto ahora — no se puede volver a mostrar. Úsalo para verificar el header{" "}
            <code>X-Webhook-Signature</code> (HMAC-SHA256 del body).
          </p>
          <code className="block break-all rounded bg-white px-3 py-2 text-sm">{justCreated.secret}</code>
          <button className="mt-2 text-xs text-blue-600 hover:underline" onClick={() => setJustCreated(null)}>
            Ya lo guardé, cerrar
          </button>
        </Card>
      )}

      {canManage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo webhook</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input
              type="url"
              placeholder="https://tu-integracion.com/webhooks/contapro"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Eventos</p>
              <div className="flex flex-wrap gap-3">
                {WEBHOOK_EVENT_OPTIONS.map((e) => (
                  <label key={e.code} className="flex items-center gap-1 text-sm text-gray-700">
                    <input type="checkbox" checked={eventTypes.includes(e.code)} onChange={() => toggleEvent(e.code)} />
                    {e.label}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={eventTypes.length === 0 || createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
        </Card>
      )}

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">URL</th>
              <th>Eventos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((w) => (
              <Fragment key={w.id}>
                <tr className="border-b border-gray-100">
                  <td className="py-2">{w.url}</td>
                  <td className="text-xs">{w.eventTypes.join(", ")}</td>
                  <td className={w.isActive ? "text-green-600" : "text-gray-400"}>{w.isActive ? "Activo" : "Inactivo"}</td>
                  <td className="text-right">
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                      >
                        {expandedId === w.id ? "Ocultar entregas" : "Ver entregas"}
                      </button>
                      {canManage && w.isActive && (
                        <Button variant="danger" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(w.id)}>
                          Desactivar
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
                {expandedId === w.id && (
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td colSpan={4} className="p-3">
                      <DeliveryHistory webhookSubscriptionId={w.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay webhooks todavia.</p>}
      </Card>
    </>
  );
}

type Section = "api-keys" | "webhooks";

export function IntegrationsPage() {
  const [section, setSection] = useState<Section>("api-keys");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Integraciones</h1>
      <p className="mb-4 text-sm text-gray-500">
        API pública (<code>/api/public/v1/...</code>) y webhooks salientes para conectar Contapro
        con Zapier, Make o un script propio de sincronización con tu tienda en línea. No incluye
        conectores nativos a Shopify/WooCommerce/Mercado Libre (requieren credenciales de
        desarrollador de cada plataforma).
      </p>
      <div className="mb-6 flex gap-2">
        <Button variant={section === "api-keys" ? "primary" : "secondary"} onClick={() => setSection("api-keys")}>
          API Keys
        </Button>
        <Button variant={section === "webhooks" ? "primary" : "secondary"} onClick={() => setSection("webhooks")}>
          Webhooks
        </Button>
      </div>

      {section === "api-keys" && <ApiKeysSection />}
      {section === "webhooks" && <WebhooksSection />}
    </AppLayout>
  );
}
