import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { EmptyState } from "../../../components/ui/EmptyState";
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
  const tone =
    status === "APPROVED" || status === "TAKEN" ? "success" : status === "REJECTED" ? "danger" : "warning";
  const label: Record<string, string> = {
    REQUESTED: "Solicitada",
    SUBMITTED: "Radicada",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    TAKEN: "Tomada",
  };
  return <Badge tone={tone}>{label[status] ?? status}</Badge>;
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
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Vacaciones y permisos</h1>

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
    <Select label="Empleado" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleccionar...</option>
      {employees
        .filter((e) => e.status === "ACTIVE")
        .map((e) => (
          <option key={e.id} value={e.id}>
            {e.firstName} {e.lastName}
          </option>
        ))}
    </Select>
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
    <Card title="Vacaciones" className="mb-6">
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
          <Button type="submit" loading={requestMutation.isPending}>
            Solicitar
          </Button>
          {requestMutation.isError && (
            <Alert tone="danger" className="w-full">
              {(requestMutation.error as Error).message}
            </Alert>
          )}
        </form>
      )}
      {canRead && data?.data.length === 0 && <EmptyState title="Sin solicitudes." />}
      {canRead && data && data.data.length > 0 && (
        <Table>
          <TableHead>
            <tr>
              <Th>Empleado</Th>
              <Th>Periodo</Th>
              <Th>Dias</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </TableHead>
          <TableBody>
            {data.data.map((v) => (
              <TableRow key={v.id}>
                <Td>{employeeNames.get(v.employeeId) ?? v.employeeId}</Td>
                <Td>
                  {formatDate(v.startDate)} a {formatDate(v.endDate)}
                </Td>
                <Td>{v.daysTaken}</Td>
                <Td>
                  <StatusBadge status={v.status} />
                </Td>
                <Td className="space-x-2 text-right">
                  {canManage && v.status === "REQUESTED" && (
                    <>
                      <Button size="sm" onClick={() => approveMutation.mutate(v.id)} loading={approveMutation.isPending}>
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => rejectMutation.mutate(v.id)}
                        loading={rejectMutation.isPending}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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
    <Card title="Permisos" className="mb-6">
      {canRequest && (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            requestMutation.mutate();
          }}
        >
          <EmployeeSelect canManage={canManage} employees={employees} value={employeeId} onChange={setEmployeeId} />
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Remunerado
          </label>
          <Button type="submit" loading={requestMutation.isPending}>
            Solicitar
          </Button>
          {requestMutation.isError && (
            <Alert tone="danger" className="w-full">
              {(requestMutation.error as Error).message}
            </Alert>
          )}
        </form>
      )}
      {canRead && data?.data.length === 0 && <EmptyState title="Sin solicitudes." />}
      {canRead && data && data.data.length > 0 && (
        <Table>
          <TableHead>
            <tr>
              <Th>Empleado</Th>
              <Th>Tipo</Th>
              <Th>Periodo</Th>
              <Th>Remunerado</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </TableHead>
          <TableBody>
            {data.data.map((p) => (
              <TableRow key={p.id}>
                <Td>{employeeNames.get(p.employeeId) ?? p.employeeId}</Td>
                <Td>{LEAVE_TYPES.find((t) => t.value === p.type)?.label ?? p.type}</Td>
                <Td>
                  {formatDate(p.startDate)} a {formatDate(p.endDate)}
                </Td>
                <Td>{p.paid ? "Si" : "No"}</Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td className="space-x-2 text-right">
                  {canManage && p.status === "REQUESTED" && (
                    <>
                      <Button size="sm" onClick={() => approveMutation.mutate(p.id)} loading={approveMutation.isPending}>
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => rejectMutation.mutate(p.id)}
                        loading={rejectMutation.isPending}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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
    <Card title="Incapacidades" className="mb-6">
      {canRequest && (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            requestMutation.mutate();
          }}
        >
          <EmployeeSelect canManage={canManage} employees={employees} value={employeeId} onChange={setEmployeeId} />
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            {SICK_LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          <Button type="submit" loading={requestMutation.isPending}>
            Radicar
          </Button>
          {requestMutation.isError && (
            <Alert tone="danger" className="w-full">
              {(requestMutation.error as Error).message}
            </Alert>
          )}
        </form>
      )}
      {canRead && data?.data.length === 0 && <EmptyState title="Sin incapacidades." />}
      {canRead && data && data.data.length > 0 && (
        <Table>
          <TableHead>
            <tr>
              <Th>Empleado</Th>
              <Th>Tipo</Th>
              <Th>Periodo</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </TableHead>
          <TableBody>
            {data.data.map((s) => (
              <TableRow key={s.id}>
                <Td>{employeeNames.get(s.employeeId) ?? s.employeeId}</Td>
                <Td>{SICK_LEAVE_TYPES.find((t) => t.value === s.type)?.label ?? s.type}</Td>
                <Td>
                  {formatDate(s.startDate)} a {formatDate(s.endDate)}
                </Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td className="space-x-2 text-right">
                  {canManage && s.status === "SUBMITTED" && (
                    <>
                      <Button size="sm" onClick={() => approveMutation.mutate(s.id)} loading={approveMutation.isPending}>
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => rejectMutation.mutate(s.id)}
                        loading={rejectMutation.isPending}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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
    <Card title="Ausencias">
      {canManage && (
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            registerMutation.mutate();
          }}
        >
          <Select label="Empleado" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Seleccionar...</option>
            {employees
              .filter((e) => e.status === "ACTIVE")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
          </Select>
          <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="UNJUSTIFIED">Injustificada</option>
            <option value="JUSTIFIED">Justificada</option>
          </Select>
          <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" loading={registerMutation.isPending}>
            Registrar
          </Button>
          {registerMutation.isError && (
            <Alert tone="danger" className="w-full">
              {(registerMutation.error as Error).message}
            </Alert>
          )}
        </form>
      )}
      {canRead && data?.data.length === 0 && <EmptyState title="Sin ausencias registradas." />}
      {canRead && data && data.data.length > 0 && (
        <Table>
          <TableHead>
            <tr>
              <Th>Empleado</Th>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Motivo</Th>
            </tr>
          </TableHead>
          <TableBody>
            {data.data.map((a) => (
              <TableRow key={a.id}>
                <Td>{employeeNames.get(a.employeeId) ?? a.employeeId}</Td>
                <Td>{formatDate(a.date)}</Td>
                <Td>{a.type === "JUSTIFIED" ? "Justificada" : "Injustificada"}</Td>
                <Td>{a.reason ?? "-"}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
