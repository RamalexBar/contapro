import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listEmployees } from "../../employees/api/employee.api";
import { getMyEmployee } from "../../timetracking/api/timetracking.api";
import {
  approveLeavePermission,
  approveSickLeave,
  approveVacation,
  listAbsences,
  listLeavePermissions,
  listSickLeaves,
  listVacations,
  registerAbsence,
  rejectLeavePermission,
  rejectSickLeave,
  rejectVacation,
  requestLeavePermission,
  requestVacation,
  submitSickLeave,
} from "../api/time-off.api";

const LEAVE_TYPES = [
  { value: "PERSONAL", label: "Personal" },
  { value: "PATERNITY", label: "Paternidad" },
  { value: "MATERNITY", label: "Maternidad" },
  { value: "BEREAVEMENT", label: "Luto" },
  { value: "OTHER", label: "Otro" },
];
const SICK_LEAVE_TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "LABOR_ARL", label: "Laboral (ARL)" },
  { value: "MATERNITY", label: "Maternidad" },
];

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "APPROVED" || status === "TAKEN"
      ? "text-green-600"
      : status === "REJECTED"
        ? "text-red-600"
        : "text-amber-600";
  const label: Record<string, string> = {
    REQUESTED: "Solicitada",
    SUBMITTED: "Radicada",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    TAKEN: "Tomada",
  };
  return <span className={color}>{label[status] ?? status}</span>;
}

export function TimeOffPage() {
  const queryClient = useQueryClient();
  const canRequest = useAuthStore((s) => s.hasPermission("timeoff.request"));
  const canManage = useAuthStore((s) => s.hasPermission("timeoff.manage"));
  const canRead = useAuthStore((s) => s.hasPermission("timeoff.read"));

  const { data: myEmployee } = useQuery({ queryKey: ["my-employee"], queryFn: getMyEmployee, enabled: canRequest });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees(), enabled: canManage });
  const employeeNames = new Map((employees?.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  function resolveEmployeeId(selected: string): string | null {
    if (canManage) return selected || null;
    return myEmployee?.id ?? null;
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Vacaciones y permisos</h1>

      <VacationSection
        canRequest={canRequest}
        canManage={canManage}
        canRead={canRead}
        employees={employees?.data ?? []}
        employeeNames={employeeNames}
        resolveEmployeeId={resolveEmployeeId}
        queryClient={queryClient}
      />
      <LeavePermissionSection
        canRequest={canRequest}
        canManage={canManage}
        canRead={canRead}
        employees={employees?.data ?? []}
        employeeNames={employeeNames}
        resolveEmployeeId={resolveEmployeeId}
        queryClient={queryClient}
      />
      <SickLeaveSection
        canRequest={canRequest}
        canManage={canManage}
        canRead={canRead}
        employees={employees?.data ?? []}
        employeeNames={employeeNames}
        resolveEmployeeId={resolveEmployeeId}
        queryClient={queryClient}
      />
      <AbsenceSection
        canManage={canManage}
        canRead={canRead}
        employees={employees?.data ?? []}
        employeeNames={employeeNames}
      />
    </AppLayout>
  );
}

interface SectionProps {
  canRequest: boolean;
  canManage: boolean;
  canRead: boolean;
  employees: { id: string; firstName: string; lastName: string; status: string }[];
  employeeNames: Map<string, string>;
  resolveEmployeeId: (selected: string) => string | null;
  queryClient: ReturnType<typeof useQueryClient>;
}

function EmployeeSelect({
  canManage,
  employees,
  value,
  onChange,
}: {
  canManage: boolean;
  employees: SectionProps["employees"];
  value: string;
  onChange: (v: string) => void;
}) {
  if (!canManage) return null;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">Empleado</span>
      <select
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seleccionar...</option>
        {employees
          .filter((e) => e.status === "ACTIVE")
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
      </select>
    </label>
  );
}

function VacationSection({ canRequest, canManage, canRead, employees, employeeNames, resolveEmployeeId, queryClient }: SectionProps) {
  const { data } = useQuery({ queryKey: ["vacations"], queryFn: () => listVacations(), enabled: canRead });

  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysTaken, setDaysTaken] = useState("");
  const requestMutation = useMutation({
    mutationFn: () =>
      requestVacation({
        employeeId: resolveEmployeeId(employeeId)!,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysTaken: Number(daysTaken),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
      setStartDate("");
      setEndDate("");
      setDaysTaken("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveVacation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacations"] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectVacation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacations"] }),
  });

  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Vacaciones</h2>
      {canRequest && (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            requestMutation.mutate();
          }}
        >
          <EmployeeSelect canManage={canManage} employees={employees} value={employeeId} onChange={setEmployeeId} />
          <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          <Input
            label="Dias"
            type="number"
            min={1}
            value={daysTaken}
            onChange={(e) => setDaysTaken(e.target.value)}
            required
          />
          <Button type="submit" disabled={requestMutation.isPending}>
            Solicitar
          </Button>
          {requestMutation.isError && (
            <p className="w-full text-sm text-red-600">{(requestMutation.error as Error).message}</p>
          )}
        </form>
      )}
      {canRead && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Empleado</th>
              <th>Periodo</th>
              <th>Dias</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((v) => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="py-2">{employeeNames.get(v.employeeId) ?? v.employeeId}</td>
                <td>
                  {formatDate(v.startDate)} a {formatDate(v.endDate)}
                </td>
                <td>{v.daysTaken}</td>
                <td>
                  <StatusBadge status={v.status} />
                </td>
                <td className="space-x-2 text-right">
                  {canManage && v.status === "REQUESTED" && (
                    <>
                      <Button onClick={() => approveMutation.mutate(v.id)} disabled={approveMutation.isPending}>
                        Aprobar
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => rejectMutation.mutate(v.id)}
                        disabled={rejectMutation.isPending}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canRead && data?.data.length === 0 && <p className="py-2 text-sm text-gray-400">Sin solicitudes.</p>}
    </Card>
  );
}

function LeavePermissionSection({ canRequest, canManage, canRead, employees, employeeNames, resolveEmployeeId, queryClient }: SectionProps) {
  const { data } = useQuery({ queryKey: ["leave-permissions"], queryFn: () => listLeavePermissions(), enabled: canRead });

  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("PERSONAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paid, setPaid] = useState(false);
  const requestMutation = useMutation({
    mutationFn: () =>
      requestLeavePermission({
        employeeId: resolveEmployeeId(employeeId)!,
        type: type as "PERSONAL" | "PATERNITY" | "MATERNITY" | "BEREAVEMENT" | "OTHER",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        paid,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-permissions"] });
      setStartDate("");
      setEndDate("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveLeavePermission(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-permissions"] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectLeavePermission(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-permissions"] }),
  });

  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Permisos</h2>
      {canRequest && (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            requestMutation.mutate();
          }}
        >
          <EmployeeSelect canManage={canManage} employees={employees} value={employeeId} onChange={setEmployeeId} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tipo</span>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Remunerado
          </label>
          <Button type="submit" disabled={requestMutation.isPending}>
            Solicitar
          </Button>
          {requestMutation.isError && (
            <p className="w-full text-sm text-red-600">{(requestMutation.error as Error).message}</p>
          )}
        </form>
      )}
      {canRead && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Empleado</th>
              <th>Tipo</th>
              <th>Periodo</th>
              <th>Remunerado</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">{employeeNames.get(p.employeeId) ?? p.employeeId}</td>
                <td>{LEAVE_TYPES.find((t) => t.value === p.type)?.label ?? p.type}</td>
                <td>
                  {formatDate(p.startDate)} a {formatDate(p.endDate)}
                </td>
                <td>{p.paid ? "Si" : "No"}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td className="space-x-2 text-right">
                  {canManage && p.status === "REQUESTED" && (
                    <>
                      <Button onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending}>
                        Aprobar
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => rejectMutation.mutate(p.id)}
                        disabled={rejectMutation.isPending}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canRead && data?.data.length === 0 && <p className="py-2 text-sm text-gray-400">Sin solicitudes.</p>}
    </Card>
  );
}

function SickLeaveSection({ canRequest, canManage, canRead, employees, employeeNames, resolveEmployeeId, queryClient }: SectionProps) {
  const { data } = useQuery({ queryKey: ["sick-leaves"], queryFn: () => listSickLeaves(), enabled: canRead });

  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("GENERAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const requestMutation = useMutation({
    mutationFn: () =>
      submitSickLeave({
        employeeId: resolveEmployeeId(employeeId)!,
        type: type as "GENERAL" | "LABOR_ARL" | "MATERNITY",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sick-leaves"] });
      setStartDate("");
      setEndDate("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveSickLeave(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sick-leaves"] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectSickLeave(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sick-leaves"] }),
  });

  return (
    <Card className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Incapacidades</h2>
      {canRequest && (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            requestMutation.mutate();
          }}
        >
          <EmployeeSelect canManage={canManage} employees={employees} value={employeeId} onChange={setEmployeeId} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tipo</span>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {SICK_LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          <Button type="submit" disabled={requestMutation.isPending}>
            Radicar
          </Button>
          {requestMutation.isError && (
            <p className="w-full text-sm text-red-600">{(requestMutation.error as Error).message}</p>
          )}
        </form>
      )}
      {canRead && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Empleado</th>
              <th>Tipo</th>
              <th>Periodo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2">{employeeNames.get(s.employeeId) ?? s.employeeId}</td>
                <td>{SICK_LEAVE_TYPES.find((t) => t.value === s.type)?.label ?? s.type}</td>
                <td>
                  {formatDate(s.startDate)} a {formatDate(s.endDate)}
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td className="space-x-2 text-right">
                  {canManage && s.status === "SUBMITTED" && (
                    <>
                      <Button onClick={() => approveMutation.mutate(s.id)} disabled={approveMutation.isPending}>
                        Aprobar
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => rejectMutation.mutate(s.id)}
                        disabled={rejectMutation.isPending}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canRead && data?.data.length === 0 && <p className="py-2 text-sm text-gray-400">Sin incapacidades.</p>}
    </Card>
  );
}

function AbsenceSection({
  canManage,
  canRead,
  employees,
  employeeNames,
}: {
  canManage: boolean;
  canRead: boolean;
  employees: SectionProps["employees"];
  employeeNames: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["absences"], queryFn: () => listAbsences(), enabled: canRead });

  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("UNJUSTIFIED");
  const [reason, setReason] = useState("");
  const registerMutation = useMutation({
    mutationFn: () =>
      registerAbsence({
        employeeId,
        date: new Date(date),
        type: type as "UNJUSTIFIED" | "JUSTIFIED",
        reason: reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      setDate("");
      setReason("");
    },
  });

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Ausencias</h2>
      {canManage && (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            registerMutation.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Empleado</span>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Seleccionar...</option>
              {employees
                .filter((e) => e.status === "ACTIVE")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
            </select>
          </label>
          <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tipo</span>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="UNJUSTIFIED">Injustificada</option>
              <option value="JUSTIFIED">Justificada</option>
            </select>
          </label>
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" disabled={registerMutation.isPending}>
            Registrar
          </Button>
          {registerMutation.isError && (
            <p className="w-full text-sm text-red-600">{(registerMutation.error as Error).message}</p>
          )}
        </form>
      )}
      {canRead && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Empleado</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-2">{employeeNames.get(a.employeeId) ?? a.employeeId}</td>
                <td>{formatDate(a.date)}</td>
                <td>{a.type === "JUSTIFIED" ? "Justificada" : "Injustificada"}</td>
                <td>{a.reason ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canRead && data?.data.length === 0 && <p className="py-2 text-sm text-gray-400">Sin ausencias registradas.</p>}
    </Card>
  );
}
