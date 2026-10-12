import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP, round2 } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Spinner } from "../../../components/ui/Spinner";
import { Alert } from "../../../components/ui/Alert";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { closeSession, getActiveSession, listCashRegisters, openSession, type CashSessionResponse } from "../api/cash.api";
import { CashSessionHistory } from "../components/CashSessionHistory";

export function CashSessionPage() {
  const queryClient = useQueryClient();
  // Mismo criterio agregado en POSPage.tsx: sin esto, un rol sin cash.session.open/close
  // (CONTADOR/EMPLEADO) veia botones "Abrir caja"/"Cerrar caja" completamente funcionales y solo
  // se enteraba de que no tenia permiso al recibir un 403 del backend al enviar el formulario.
  const canOpen = useAuthStore((s) => s.hasPermission("cash.session.open"));
  const canClose = useAuthStore((s) => s.hasPermission("cash.session.close"));
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: registers } = useQuery({ queryKey: ["cash-registers"], queryFn: listCashRegisters });
  // Cada sucursal tiene su caja; GET /cash/registers ya devuelve solo las de la sucursal activa.
  const register = registers?.data[0];
  const registerId = register?.id;

  const { data: activeSession, isLoading } = useQuery({
    queryKey: ["cash-active-session", registerId],
    queryFn: () => getActiveSession(registerId as string),
    enabled: Boolean(registerId),
  });

  const [openingAmount, setOpeningAmount] = useState("100000");
  const [closingAmount, setClosingAmount] = useState("");
  // Con diferencia, el cierre pide confirmar: un conteo vacio o con un cero de mas registraba un
  // faltante o sobrante de millones con su asiento contable.
  const [confirmingDifference, setConfirmingDifference] = useState(false);
  const [lastClosed, setLastClosed] = useState<CashSessionResponse | null>(null);

  const openMutation = useMutation({
    mutationFn: () => openSession({ cashRegisterId: registerId as string, openingAmount: Number(openingAmount) }),
    onSuccess: () => {
      setLastClosed(null);
      queryClient.invalidateQueries({ queryKey: ["cash-active-session"] });
      queryClient.invalidateQueries({ queryKey: ["cash-sessions"] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeSession(activeSession!.id, { closingAmountCounted: Number(closingAmount) }),
    onSuccess: (closed) => {
      setLastClosed(closed);
      setClosingAmount("");
      setConfirmingDifference(false);
      queryClient.invalidateQueries({ queryKey: ["cash-active-session"] });
      queryClient.invalidateQueries({ queryKey: ["cash-sessions"] });
    },
  });

  const hasCount = closingAmount.trim() !== "" && Number(closingAmount) >= 0;
  const difference = activeSession && hasCount ? round2(Number(closingAmount) - activeSession.expectedAmount) : 0;

  function onClose() {
    if (!hasCount) return;
    if (difference !== 0 && !confirmingDifference) {
      setConfirmingDifference(true);
      return;
    }
    closeMutation.mutate();
  }

  return (
    <AppLayout>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Caja</h1>
      <p className="mb-4 text-sm text-slate-500">{register ? register.name : "Esta sucursal no tiene caja"}</p>

      {lastClosed && (
        <Alert tone={lastClosed.difference ? "warning" : "success"} className="mb-4 max-w-md">
          Caja cerrada. Esperado {formatCOP(lastClosed.closingAmountExpected ?? 0)}, contado {formatCOP(lastClosed.closingAmountCounted ?? 0)}
          {lastClosed.difference
            ? `: ${lastClosed.difference > 0 ? "sobrante" : "faltante"} de ${formatCOP(Math.abs(lastClosed.difference))}, registrado en contabilidad.`
            : ", sin diferencia."}
        </Alert>
      )}

      <Card className="max-w-md">
        {isLoading && <Spinner />}

        {!isLoading && !activeSession && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">No hay una sesion de caja abierta.</p>
            {canOpen ? (
              <>
                <Input label="Dinero inicial" type="number" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
                <Button onClick={() => openMutation.mutate()} disabled={!registerId || openMutation.isPending} loading={openMutation.isPending}>
                  Abrir caja
                </Button>
                {openMutation.isError && <Alert tone="danger">{(openMutation.error as Error).message}</Alert>}
              </>
            ) : (
              <Alert tone="warning">Tu usuario no tiene permiso para abrir caja.</Alert>
            )}
          </div>
        )}

        {activeSession && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500">Abierta por</dt>
              <dd className="text-right font-medium text-slate-900">
                {activeSession.openedByName ?? "-"}
                {activeSession.openedByUserId === currentUserId ? " (tu)" : ""}
              </dd>
              <dt className="text-slate-500">Base al abrir</dt>
              <dd className="text-right text-slate-900">{formatCOP(activeSession.openingAmount)}</dd>
              <dt className="text-slate-500">Deberia haber en caja</dt>
              <dd className="text-right font-semibold text-slate-900">{formatCOP(activeSession.expectedAmount)}</dd>
            </dl>
            <p className="text-xs text-slate-500">
              Base mas ventas en efectivo y entradas, menos salidas, desde{" "}
              {new Date(activeSession.openedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
            </p>
            {activeSession.openedByUserId !== currentUserId && (
              <Alert tone="warning">
                Este turno lo abrio {activeSession.openedByName ?? "otra persona"}. Si ahora te toca a ti, cuenta el efectivo con esa persona,
                cierra su turno y abre el tuyo: asi lo que vendas queda a tu nombre.
              </Alert>
            )}
            {canClose ? (
              <>
                <Input
                  label="Dinero contado al cierre"
                  type="number"
                  min={0}
                  placeholder="Cuenta el efectivo y escribelo"
                  value={closingAmount}
                  onChange={(e) => {
                    setClosingAmount(e.target.value);
                    setConfirmingDifference(false);
                  }}
                />
                {hasCount && difference !== 0 && (
                  <p className={`text-sm font-medium ${difference > 0 ? "text-warning-700" : "text-danger-600"}`}>
                    {difference > 0 ? "Sobran" : "Faltan"} {formatCOP(Math.abs(difference))}
                  </p>
                )}
                {confirmingDifference ? (
                  <Alert tone="warning">
                    <p>
                      Vas a cerrar con un <strong>{difference > 0 ? "sobrante" : "faltante"} de {formatCOP(Math.abs(difference))}</strong>, y se
                      registra en contabilidad. Revisa el conteo antes de seguir.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="danger" loading={closeMutation.isPending} onClick={onClose}>
                        Si, cerrar con la diferencia
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmingDifference(false)}>
                        Revisar conteo
                      </Button>
                    </div>
                  </Alert>
                ) : (
                  <Button variant="danger" onClick={onClose} disabled={!hasCount} loading={closeMutation.isPending}>
                    Cerrar caja (arqueo)
                  </Button>
                )}
                {closeMutation.isError && <Alert tone="danger">{(closeMutation.error as Error).message}</Alert>}
              </>
            ) : (
              <Alert tone="warning">Tu usuario no tiene permiso para cerrar caja.</Alert>
            )}
          </div>
        )}
      </Card>

      {registerId && <CashSessionHistory cashRegisterId={registerId} />}
    </AppLayout>
  );
}
