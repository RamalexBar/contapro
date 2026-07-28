import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listEmployees } from "../../employees/api/employee.api";
import { clockIn, clockOut, getMyEmployee, getMyOpenEntry, listTimeEntries } from "../api/timetracking.api";

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function durationLabel(clockInAt: string, clockOutAt: string | null): string {
  if (!clockOutAt) return "En curso";
  const ms = new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function TimeTrackingPage() {
  const queryClient = useQueryClient();
  const canClock = useAuthStore((s) => s.hasPermission("timetracking.clock"));
  const canManage = useAuthStore((s) => s.hasPermission("timetracking.manage"));
  const canRead = useAuthStore((s) => s.hasPermission("timetracking.read"));

  // ---- Marcacion propia (self-service) ----
  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee"],
    queryFn: getMyEmployee,
    enabled: canClock,
  });
  const { data: myOpenEntry, isLoading: loadingMyStatus } = useQuery({
    queryKey: ["my-open-entry"],
    queryFn: getMyOpenEntry,
    enabled: canClock && Boolean(myEmployee),
  });

  const myClockInMutation = useMutation({
    mutationFn: () => clockIn({ employeeId: myEmployee!.id, source: "MANUAL" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-open-entry"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
  const myClockOutMutation = useMutation({
    mutationFn: () => clockOut(myOpenEntry!.id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-open-entry"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });

  // ---- Listado / gestion (timetracking.read / timetracking.manage) ----
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees(), enabled: canRead });
  const employeeNames = new Map((employees?.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const { data: entries, isLoading } = useQuery({
    queryKey: ["time-entries", filterEmployeeId, filterFrom, filterTo],
    queryFn: () =>
      listTimeEntries({
        employeeId: filterEmployeeId || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      }),
    enabled: canRead,
  });

  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const manualClockInMutation = useMutation({
    mutationFn: () => clockIn({ employeeId: manualEmployeeId, source: "MANUAL" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["time-entries"] }),
  });
  const manualClockOutMutation = useMutation({
    mutationFn: (id: string) => clockOut(id, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["time-entries"] }),
  });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Control de horarios</h1>

      {canClock && (
        <Card className="mb-6 max-w-md">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Mi marcacion</h2>
          {!myEmployee && (
            <p className="text-sm text-gray-500">
              Tu usuario no esta vinculado a un empleado, no puedes marcar entrada/salida.
            </p>
          )}
          {myEmployee && loadingMyStatus && <p className="text-sm text-gray-500">Cargando...</p>}
          {myEmployee && !loadingMyStatus && (
            <div className="space-y-2">
              {myOpenEntry ? (
                <>
                  <p className="text-sm text-gray-600">
                    Entrada marcada: <strong>{formatDateTime(myOpenEntry.clockIn)}</strong>
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => myClockOutMutation.mutate()}
                    disabled={myClockOutMutation.isPending}
                  >
                    Marcar salida
                  </Button>
                </>
              ) : (
                <Button onClick={() => myClockInMutation.mutate()} disabled={myClockInMutation.isPending}>
                  Marcar entrada
                </Button>
              )}
              {(myClockInMutation.isError || myClockOutMutation.isError) && (
                <p className="text-sm text-red-600">
                  {((myClockInMutation.error ?? myClockOutMutation.error) as Error).message}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {canManage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Marcar por otro empleado</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Empleado</span>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={manualEmployeeId}
                onChange={(e) => setManualEmployeeId(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {employees?.data
                  .filter((e) => e.status === "ACTIVE")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              disabled={!manualEmployeeId || manualClockInMutation.isPending}
              onClick={() => manualClockInMutation.mutate()}
            >
              Marcar entrada
            </Button>
          </div>
          {manualClockInMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{(manualClockInMutation.error as Error).message}</p>
          )}
        </Card>
      )}

      {canRead && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Registros</h2>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Empleado</span>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
              >
                <option value="">Todos</option>
                {employees?.data.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Desde" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <Input label="Hasta" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>

          {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Empleado</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Duracion</th>
                <th>Origen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries?.data.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="py-2">{employeeNames.get(entry.employeeId) ?? entry.employeeId}</td>
                  <td>{formatDateTime(entry.clockIn)}</td>
                  <td>{formatDateTime(entry.clockOut)}</td>
                  <td>{durationLabel(entry.clockIn, entry.clockOut)}</td>
                  <td>{entry.source}</td>
                  <td className="text-right">
                    {canManage && !entry.clockOut && (
                      <Button
                        variant="secondary"
                        onClick={() => manualClockOutMutation.mutate(entry.id)}
                        disabled={manualClockOutMutation.isPending}
                      >
                        Marcar salida
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay registros.</p>}
        </Card>
      )}
    </AppLayout>
  );
}
