import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { getInventoryReconciliation, regularizeInventoryAccount } from "../api/accounting.api";

/** Cuenta 1435 contra el inventario valorizado real, con el asiento de regularizacion por la diferencia. */
export function InventoryReconciliationReport() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission("accounting.manage"));
  const { data, isLoading, error } = useQuery({ queryKey: ["accounting", "inventory-reconciliation"], queryFn: getInventoryReconciliation });
  const mutation = useMutation({
    mutationFn: regularizeInventoryAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting"] }),
  });
  const squared = data ? Math.abs(data.difference) < 0.01 : false;

  return (
    <Card>
      <p className="mb-4 text-sm text-slate-500">
        Compara el saldo contable de la cuenta 1435 (Inventarios) con lo que vale de verdad el inventario hoy (Inventario → Inventario valorizado).
        Deben ser iguales. Si no lo son, el asiento de regularización ajusta la 1435 contra 3115 Aportes sociales.
      </p>
      {isLoading && <Spinner />}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}
      {data?.cajaproCombo && (
        <Alert tone="info">
          Esta empresa usa el combo con Cajapro: los productos, las existencias y su costo se manejan en Cajapro, así que esta conciliación no
          aplica. Saldo actual de la cuenta 1435: {formatCOP(data.ledgerBalance)}.
        </Alert>
      )}
      {data && !data.cajaproCombo && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Saldo cuenta 1435</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${data.ledgerBalance < 0 ? "text-red-600" : "text-slate-900"}`}>
                {formatCOP(data.ledgerBalance)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Inventario valorizado</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatCOP(data.inventoryValue)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Diferencia</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${squared ? "text-emerald-700" : "text-amber-600"}`}>{formatCOP(data.difference)}</p>
            </div>
          </div>
          {squared ? (
            <Alert tone="success">La cuenta 1435 cuadra con el inventario.</Alert>
          ) : (
            <Alert tone="warning">
              Falta registrar {data.difference > 0 ? "en" : "fuera de"} la 1435 {formatCOP(Math.abs(data.difference))}: mercancía que entró o salió sin
              asiento contable (normalmente existencias iniciales cargadas antes del 10 de noviembre de 2026).
            </Alert>
          )}
          {!squared && canManage && (
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Registrando..." : `Registrar asiento de regularización por ${formatCOP(Math.abs(data.difference))}`}
            </Button>
          )}
          {mutation.error && <Alert tone="danger">{(mutation.error as Error).message}</Alert>}
          {mutation.data?.entry && <Alert tone="success">Asiento #{mutation.data.entry.number} registrado. Lo ves en el Libro Diario.</Alert>}
        </div>
      )}
    </Card>
  );
}
