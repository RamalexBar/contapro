import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
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
        <Alert tone="info" className="mb-6">
          <p className="mb-1 font-semibold">API key creada: {justCreated.name}</p>
          <p className="mb-2">
            Guárdala ahora — no se puede volver a mostrar. Úsala en el header{" "}
            <code>Authorization: Bearer &lt;key&gt;</code> contra <code>/api/public/v1/...</code>.
          </p>
          <code className="block break-all rounded bg-white px-3 py-2 text-sm">{justCreated.key}</code>
          <button className="mt-2 text-xs underline" onClick={() => setJustCreated(null)}>
            Ya la guardé, cerrar
          </button>
        </Alert>
      )}

      {canManage && (
        <Card title="Nueva API key" className="mb-6">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input placeholder="Nombre (ej. Integracion Shopify)" value={name} onChange={(e) => setName(e.target.value)} required />
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Scopes</p>
              <div className="flex flex-wrap gap-3">
                {availableScopes.map((s) => (
                  <label key={s.code} className="flex items-center gap-1 text-sm text-slate-700">
                    <input type="checkbox" checked={scopes.includes(s.code)} onChange={() => toggleScope(s.code)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={scopes.length === 0} loading={createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(createMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="No hay API keys todavia." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Nombre</Th>
                <Th>Prefijo</Th>
                <Th>Scopes</Th>
                <Th>Ultimo uso</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((k) => (
                <TableRow key={k.id}>
                  <Td>{k.name}</Td>
                  <Td>
                    <code>{k.keyPrefix}...</code>
                  </Td>
                  <Td className="text-xs">{k.scopes.join(", ")}</Td>
                  <Td>{k.lastUsedAt ? k.lastUsedAt.slice(0, 10) : "Nunca"}</Td>
                  <Td>
                    <Badge tone={k.isActive ? "success" : "neutral"}>{k.isActive ? "Activa" : "Revocada"}</Badge>
                  </Td>
                  <Td className="text-right">
                    {canManage && k.isActive && (
                      <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(k.id)}>
                        Revocar
                      </Button>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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

  if (isLoading) return <Spinner label="Cargando historial..." />;
  if (!data?.data.length) return <p className="text-sm text-slate-400">Todavia no se ha disparado ningun evento.</p>;

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>Fecha</Th>
          <Th>Evento</Th>
          <Th>Resultado</Th>
          <Th></Th>
        </tr>
      </TableHead>
      <TableBody>
        {data.data.map((d) => (
          <TableRow key={d.id}>
            <Td>{d.attemptedAt.slice(0, 19).replace("T", " ")}</Td>
            <Td>{d.eventType}</Td>
            <Td>
              <Badge tone={d.success ? "success" : "danger"}>
                {d.success ? `OK (${d.responseStatus})` : d.errorMessage ?? `Fallo (${d.responseStatus ?? "sin respuesta"})`}
              </Badge>
            </Td>
            <Td className="text-right">
              {!d.success && (
                <Button size="sm" variant="secondary" loading={resendMutation.isPending} onClick={() => resendMutation.mutate(d.id)}>
                  Reenviar
                </Button>
              )}
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
        <Alert tone="info" className="mb-6">
          <p className="mb-1 font-semibold">Webhook creado apuntando a {justCreated.url}</p>
          <p className="mb-2">
            Guarda este secreto ahora — no se puede volver a mostrar. Úsalo para verificar el header{" "}
            <code>X-Webhook-Signature</code> (HMAC-SHA256 del body).
          </p>
          <code className="block break-all rounded bg-white px-3 py-2 text-sm">{justCreated.secret}</code>
          <button className="mt-2 text-xs underline" onClick={() => setJustCreated(null)}>
            Ya lo guardé, cerrar
          </button>
        </Alert>
      )}

      {canManage && (
        <Card title="Nuevo webhook" className="mb-6">
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
              <p className="mb-1 text-xs font-medium text-slate-600">Eventos</p>
              <div className="flex flex-wrap gap-3">
                {WEBHOOK_EVENT_OPTIONS.map((e) => (
                  <label key={e.code} className="flex items-center gap-1 text-sm text-slate-700">
                    <input type="checkbox" checked={eventTypes.includes(e.code)} onChange={() => toggleEvent(e.code)} />
                    {e.label}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={eventTypes.length === 0} loading={createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(createMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : data?.data.length === 0 ? (
          <EmptyState title="No hay webhooks todavia." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>URL</Th>
                <Th>Eventos</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((w) => (
                <Fragment key={w.id}>
                  <TableRow>
                    <Td>{w.url}</Td>
                    <Td className="text-xs">{w.eventTypes.join(", ")}</Td>
                    <Td>
                      <Badge tone={w.isActive ? "success" : "neutral"}>{w.isActive ? "Activo" : "Inactivo"}</Badge>
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                        >
                          {expandedId === w.id ? "Ocultar entregas" : "Ver entregas"}
                        </button>
                        {canManage && w.isActive && (
                          <Button size="sm" variant="danger" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(w.id)}>
                            Desactivar
                          </Button>
                        )}
                      </span>
                    </Td>
                  </TableRow>
                  {expandedId === w.id && (
                    <TableRow>
                      <Td colSpan={4} className="bg-slate-50 p-3">
                        <DeliveryHistory webhookSubscriptionId={w.id} />
                      </Td>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

type Section = "api-keys" | "webhooks";

export function IntegrationsPage() {
  const [section, setSection] = useState<Section>("api-keys");

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Integraciones</h1>
      <p className="mb-4 text-sm text-slate-500">
        API pública (<code>/api/public/v1/...</code>) y webhooks salientes para conectar Contapro
        con Zapier, Make o un script propio de sincronización con tu tienda en línea. No incluye
        conectores nativos a Shopify/WooCommerce/Mercado Libre (requieren credenciales de
        desarrollador de cada plataforma).
      </p>
      <div className="mb-6 flex gap-2">
        <Button size="sm" variant={section === "api-keys" ? "primary" : "secondary"} onClick={() => setSection("api-keys")}>
          API Keys
        </Button>
        <Button size="sm" variant={section === "webhooks" ? "primary" : "secondary"} onClick={() => setSection("webhooks")}>
          Webhooks
        </Button>
      </div>

      {section === "api-keys" && <ApiKeysSection />}
      {section === "webhooks" && <WebhooksSection />}
    </AppLayout>
  );
}
