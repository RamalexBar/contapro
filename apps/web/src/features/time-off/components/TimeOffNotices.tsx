import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { getTimeOffNotifications, markTimeOffNotificationsSeen, type TimeOffKind } from "../api/time-off.api";

const KIND_LABEL: Record<TimeOffKind, string> = {
  vacation: "vacaciones",
  "leave-permission": "permiso",
  "sick-leave": "incapacidad",
};

const day = (iso: string) => iso.slice(0, 10);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Avisos de vacaciones, permisos e incapacidades: al administrador, cuantas solicitudes tiene por
 * revisar (solo en el Dashboard, con enlace); al empleado, la respuesta a las suyas hasta que pulse
 * "Entendido".
 */
export function TimeOffNotices({ showPending }: { showPending: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["time-off-notifications"], queryFn: getTimeOffNotifications, staleTime: 60_000 });
  const seenMutation = useMutation({
    mutationFn: markTimeOffNotificationsSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["time-off-notifications"] }),
  });

  if (!data) return null;
  const pending = showPending && data.pending && data.pending.total > 0 ? data.pending : null;
  if (!pending && data.decisions.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {pending && (
        <Alert tone="warning">
          <span>
            Tienes {plural(pending.total, "solicitud", "solicitudes")} por revisar:{" "}
            {[
              pending.vacations ? plural(pending.vacations, "de vacaciones", "de vacaciones") : null,
              pending.leavePermissions ? plural(pending.leavePermissions, "permiso", "permisos") : null,
              pending.sickLeaves ? plural(pending.sickLeaves, "incapacidad", "incapacidades") : null,
            ]
              .filter(Boolean)
              .join(", ")}
            .{" "}
            <Link to="/time-off" className="font-medium underline">
              Revisar
            </Link>
          </span>
        </Alert>
      )}

      {data.decisions.length > 0 && (
        <Alert tone={data.decisions.every((d) => d.status === "APPROVED") ? "success" : "info"}>
          <ul className="space-y-1">
            {data.decisions.map((d) => (
              <li key={`${d.kind}-${d.id}`}>
                Tu solicitud de {KIND_LABEL[d.kind]} fue <strong>{d.status === "APPROVED" ? "aprobada" : "rechazada"}</strong>
                {d.status === "APPROVED" && (
                  <>
                    {" "}
                    del {day(d.startDate)} al {day(d.endDate)}
                    {d.requestedStartDate && d.requestedEndDate && ` (habias pedido del ${day(d.requestedStartDate)} al ${day(d.requestedEndDate)})`}
                  </>
                )}
                {d.decisionNote && <>. {d.status === "REJECTED" ? "Motivo" : "Nota"}: {d.decisionNote}</>}.
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" className="mt-2" loading={seenMutation.isPending} onClick={() => seenMutation.mutate()}>
            Entendido
          </Button>
        </Alert>
      )}
    </div>
  );
}
