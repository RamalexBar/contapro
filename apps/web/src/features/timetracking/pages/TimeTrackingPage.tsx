import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
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
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Control de horarios</h1>

      {canClock && (
        <Card title="Mi marcacion" className="mb-6 max-w-md">
          {!myEmployee && (
            <p className="text-sm text-slate-500">
              Tu usuario no esta vinculado a un empleado, no puedes marcar entrada/salida.
            </p>
          )}
          {myEmployee && loadingMyStatus && <Spinner />}
          {myEmployee && !loadingMyStatus && (
            <div className="space-y-2">
              {myOpenEntry ? (
                <>
                  <p className="text-sm text-slate-600">
                    Entrada marcada: <strong>{formatDateTime(myOpenEntry.clockIn)}</strong>
                  </p>
                  <Button variant="danger" onClick={() => myClockOutMutation.mutate()} loading={myClockOutMutation.isPending}>
                    Marcar salida
                  </Button>
                </>
              ) : (
                <Button onClick={() => myClockInMutation.mutate()} loading={myClockInMutation.isPending}>
                  Marcar entrada
                </Button>
              )}
              {(myClockInMutation.isError || myClockOutMutation.isError) && (
                <Alert tone="danger">{((myClockInMutation.error ?? myClockOutMutation.error) as Error).message}</Alert>
              )}
            </div>
          )}
        </Card>
      )}

      {canManage && (
        <Card title="Marcar por otro empleado" className="mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Empleado" value={manualEmployeeId} onChange={(e) => setManualEmployeeId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {employees?.data
                .filter((e) => e.status === "ACTIVE")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
            </Select>
            <Button
              disabled={!manualEmployeeId}
              loading={manualClockInMutation.isPending}
              onClick={() => manualClockInMutation.mutate()}
            >
              Marcar entrada
            </Button>
          </div>
          {manualClockInMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(manualClockInMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      {canRead && (
        <Card title="Registros" noPadding>
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
            <Select label="Empleado" value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)}>
              <option value="">Todos</option>
              {employees?.data.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </Select>
            <Input label="Desde" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <Input label="Hasta" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>

          {isLoading ? (
            <Spinner />
          ) : entries?.data.length === 0 ? (
            <EmptyState title="No hay registros." />
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <Th>Empleado</Th>
                  <Th>Entrada</Th>
                  <Th>Salida</Th>
                  <Th>Duracion</Th>
                  <Th>Origen</Th>
                  <Th></Th>
                </tr>
              </TableHead>
              <TableBody>
                {entries?.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <Td>{employeeNames.get(entry.employeeId) ?? entry.employeeId}</Td>
                    <Td>{formatDateTime(entry.clockIn)}</Td>
                    <Td>{formatDateTime(entry.clockOut)}</Td>
                    <Td>{durationLabel(entry.clockIn, entry.clockOut)}</Td>
                    <Td>{entry.source}</Td>
                    <Td className="text-right">
                      {canManage && !entry.clockOut && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => manualClockOutMutation.mutate(entry.id)}
                          loading={manualClockOutMutation.isPending}
                        >
                          Marcar salida
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </AppLayout>
  );
}
