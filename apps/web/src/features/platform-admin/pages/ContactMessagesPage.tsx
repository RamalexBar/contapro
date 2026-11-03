import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { listContactMessages, setContactMessageHandled } from "../api/saas-admin.api";

const when = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^(?!57)(\d{10})$/, "57$1")}`;

/** Mensajes del formulario de contacto de contapro.com.co: los pendientes primero, para no dejar a nadie sin respuesta. */
export function ContactMessagesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "contact-messages"], queryFn: listContactMessages });
  const [showHandled, setShowHandled] = useState(false);
  const mutation = useMutation({
    mutationFn: ({ id, handled }: { id: string; handled: boolean }) => setContactMessageHandled(id, handled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saas-admin", "contact-messages"] }),
  });

  const all = data?.data ?? [];
  const pending = all.filter((m) => !m.handledAt);
  const rows = showHandled ? all : pending;

  return (
    <PlatformAdminLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Mensajes de contacto</h1>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} />
          Ver también los atendidos ({all.length - pending.length})
        </label>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Lo que escriben en el formulario de contapro.com.co. También le llega a su correo de avisos; respondiendo ese correo le contesta a la
        persona.
      </p>

      {isLoading && <Spinner />}
      {!isLoading && rows.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">{pending.length === 0 ? "No hay mensajes pendientes." : "No hay mensajes."}</p>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {m.name}
                  {m.company && <span className="font-normal text-slate-500"> · {m.company}</span>}
                </p>
                <p className="text-xs text-slate-500">{when(m.createdAt)}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{m.message}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="text-brand-700 hover:underline">
                      {m.email}
                    </a>
                  )}
                  {m.phone && (
                    <a href={waLink(m.phone)} target="_blank" rel="noopener noreferrer" className="text-success-700 hover:underline">
                      WhatsApp {m.phone}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {m.handledAt ? <Badge tone="success">Atendido</Badge> : <Badge tone="warning">Pendiente</Badge>}
                <Button
                  size="sm"
                  variant={m.handledAt ? "ghost" : "secondary"}
                  loading={mutation.isPending && mutation.variables?.id === m.id}
                  onClick={() => mutation.mutate({ id: m.id, handled: !m.handledAt })}
                >
                  {m.handledAt ? "Marcar pendiente" : "Marcar atendido"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PlatformAdminLayout>
  );
}
