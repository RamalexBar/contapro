import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import {
  createEmployee,
  deactivateEmployee,
  type EmployeeRecord,
  listEmployees,
  updateEmployee,
} from "../api/employee.api";

const CONTRACT_TYPES = [
  { value: "INDEFINITE", label: "Indefinido" },
  { value: "FIXED_TERM", label: "Termino fijo" },
  { value: "SERVICE", label: "Prestacion de servicios" },
  { value: "LEARNING", label: "Aprendizaje" },
];

const ARL_LEVELS = ["I", "II", "III", "IV", "V"];

const EMPTY_FORM = {
  documentType: "CC",
  documentNumber: "",
  firstName: "",
  lastName: "",
  position: "",
  contractType: "INDEFINITE",
  baseSalary: "",
  hireDate: "",
  eps: "",
  arlRiskLevel: "I",
  pensionFund: "",
  compensationFund: "",
};

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

export function EmployeeListPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canCreate = useAuthStore((s) => s.hasPermission("employee.create"));
  const canUpdate = useAuthStore((s) => s.hasPermission("employee.update"));
  const canDeactivate = useAuthStore((s) => s.hasPermission("employee.deactivate"));

  const { data, isLoading } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  const [form, setForm] = useState(EMPTY_FORM);
  const createMutation = useMutation({
    mutationFn: () =>
      createEmployee({
        branchId: user!.branchId!,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        firstName: form.firstName,
        lastName: form.lastName,
        position: form.position,
        contractType: form.contractType as "INDEFINITE" | "FIXED_TERM" | "SERVICE" | "LEARNING",
        baseSalary: Number(form.baseSalary),
        hireDate: new Date(form.hireDate),
        eps: form.eps || undefined,
        arlRiskLevel: form.arlRiskLevel as "I" | "II" | "III" | "IV" | "V",
        pensionFund: form.pensionFund || undefined,
        compensationFund: form.compensationFund || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setForm(EMPTY_FORM);
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ position: "", baseSalary: "" });
  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      updateEmployee(id, { position: editValues.position, baseSalary: Number(editValues.baseSalary) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEditingId(null);
    },
  });

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [terminationDate, setTerminationDate] = useState("");
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateEmployee(id, terminationDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDeactivatingId(null);
    },
  });

  function startEdit(employee: EmployeeRecord) {
    setEditingId(employee.id);
    setEditValues({ position: employee.position, baseSalary: String(employee.baseSalary) });
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Empleados</h1>

      {canCreate && (
        <Card title="Nuevo empleado" className="mb-6">
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input
              placeholder="Cedula"
              value={form.documentNumber}
              onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
              required
            />
            <Input
              placeholder="Nombres"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Input
              placeholder="Apellidos"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
            <Input
              placeholder="Cargo"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              required
            />
            <Select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
              {CONTRACT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Salario base"
              type="number"
              value={form.baseSalary}
              onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
              required
            />
            <Input
              placeholder="Fecha de ingreso"
              type="date"
              value={form.hireDate}
              onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              required
            />
            <Select value={form.arlRiskLevel} onChange={(e) => setForm({ ...form, arlRiskLevel: e.target.value })}>
              {ARL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  ARL nivel {l}
                </option>
              ))}
            </Select>
            <Input placeholder="EPS" value={form.eps} onChange={(e) => setForm({ ...form, eps: e.target.value })} />
            <Input
              placeholder="Fondo de pension"
              value={form.pensionFund}
              onChange={(e) => setForm({ ...form, pensionFund: e.target.value })}
            />
            <Input
              placeholder="Caja de compensacion"
              value={form.compensationFund}
              onChange={(e) => setForm({ ...form, compensationFund: e.target.value })}
            />
            <Button type="submit" loading={createMutation.isPending}>
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
          <EmptyState title="No hay empleados registrados." />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Documento</Th>
                <Th>Nombre</Th>
                <Th>Cargo</Th>
                <Th>Contrato</Th>
                <Th>Salario</Th>
                <Th>Ingreso</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((employee) => (
                <TableRow key={employee.id}>
                  <Td>{employee.documentNumber}</Td>
                  <Td>
                    {employee.firstName} {employee.lastName}
                  </Td>
                  <Td>
                    {editingId === employee.id ? (
                      <Input
                        className="w-32"
                        value={editValues.position}
                        onChange={(e) => setEditValues({ ...editValues, position: e.target.value })}
                      />
                    ) : (
                      employee.position
                    )}
                  </Td>
                  <Td>{CONTRACT_TYPES.find((c) => c.value === employee.contractType)?.label ?? employee.contractType}</Td>
                  <Td>
                    {editingId === employee.id ? (
                      <Input
                        type="number"
                        className="w-28"
                        value={editValues.baseSalary}
                        onChange={(e) => setEditValues({ ...editValues, baseSalary: e.target.value })}
                      />
                    ) : (
                      formatCOP(employee.baseSalary)
                    )}
                  </Td>
                  <Td>{formatDate(employee.hireDate)}</Td>
                  <Td>
                    <Badge tone={employee.status === "ACTIVE" ? "success" : "neutral"}>
                      {employee.status === "ACTIVE" ? "Activo" : "Inactivo"}
                    </Badge>
                  </Td>
                  <Td className="space-x-2 text-right">
                    {canUpdate && editingId === employee.id && (
                      <>
                        <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate(employee.id)}>
                          Guardar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                    {canUpdate && editingId !== employee.id && employee.status === "ACTIVE" && (
                      <Button size="sm" variant="secondary" onClick={() => startEdit(employee)}>
                        Editar
                      </Button>
                    )}
                    {canDeactivate && employee.status === "ACTIVE" && deactivatingId !== employee.id && (
                      <Button size="sm" variant="danger" onClick={() => setDeactivatingId(employee.id)}>
                        Dar de baja
                      </Button>
                    )}
                    {canDeactivate && deactivatingId === employee.id && (
                      <span className="inline-flex items-center gap-2">
                        <Input
                          type="date"
                          className="w-auto"
                          value={terminationDate}
                          onChange={(e) => setTerminationDate(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!terminationDate}
                          loading={deactivateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(employee.id)}
                        >
                          Confirmar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setDeactivatingId(null)}>
                          Cancelar
                        </Button>
                      </span>
                    )}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
