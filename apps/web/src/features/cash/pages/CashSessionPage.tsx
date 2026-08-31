import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Spinner } from "../../../components/ui/Spinner";
import { Alert } from "../../../components/ui/Alert";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { closeSession, getActiveSession, listCashRegisters, openSession } from "../api/cash.api";

export function CashSessionPage() {
  const queryClient = useQueryClient();
  // Mismo criterio agregado en POSPage.tsx: sin esto, un rol sin cash.session.open/close
  // (CONTADOR/EMPLEADO) veia botones "Abrir caja"/"Cerrar caja" completamente funcionales y solo
  // se enteraba de que no tenia permiso al recibir un 403 del backend al enviar el formulario.
  const canOpen = useAuthStore((s) => s.hasPermission("cash.session.open"));
  const canClose = useAuthStore((s) => s.hasPermission("cash.session.close"));
  const { data: registers } = useQuery({ queryKey: ["cash-registers"], queryFn: listCashRegisters });
  const registerId = registers?.data[0]?.id;

  const { data: activeSession, isLoading } = useQuery({
    queryKey: ["cash-active-session", registerId],
    queryFn: () => getActiveSession(registerId as string),
    enabled: Boolean(registerId),
  });

  const [openingAmount, setOpeningAmount] = useState("100000");
  const [closingAmount, setClosingAmount] = useState("");

  const openMutation = useMutation({
    mutationFn: () => openSession({ cashRegisterId: registerId as string, openingAmount: Number(openingAmount) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash-active-session"] }),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeSession(activeSession!.id, { closingAmountCounted: Number(closingAmount) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash-active-session"] }),
  });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Caja</h1>
      <Card className="max-w-md">
        {isLoading && <Spinner />}

        {!isLoading && !activeSession && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">No hay una sesion de caja abierta.</p>
            {canOpen ? (
              <>
                <Input label="Dinero inicial" type="number" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
                <Button onClick={() => openMutation.mutate()} disabled={!registerId} loading={openMutation.isPending}>
                  Abrir caja
                </Button>
              </>
            ) : (
              <Alert tone="warning">Tu usuario no tiene permiso para abrir caja.</Alert>
            )}
          </div>
        )}

        {activeSession && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Caja abierta con <strong className="text-slate-900">{formatCOP(activeSession.openingAmount)}</strong>
            </p>
            {canClose ? (
              <>
                <Input label="Dinero contado al cierre" type="number" value={closingAmount} onChange={(e) => setClosingAmount(e.target.value)} />
                <Button variant="danger" onClick={() => closeMutation.mutate()} loading={closeMutation.isPending}>
                  Cerrar caja (arqueo)
                </Button>
                {closeMutation.data && (
                  <p className="text-sm text-slate-600">
                    Esperado: {formatCOP(closeMutation.data.closingAmountExpected ?? 0)} — Diferencia:{" "}
                    {formatCOP(closeMutation.data.difference ?? 0)}
                  </p>
                )}
              </>
            ) : (
              <Alert tone="warning">Tu usuario no tiene permiso para cerrar caja.</Alert>
            )}
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
