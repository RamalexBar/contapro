import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
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
      <h1 className="mb-4 text-lg font-semibold">Empleados</h1>

      {canCreate && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo empleado</h2>
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
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.contractType}
              onChange={(e) => setForm({ ...form, contractType: e.target.value })}
            >
              {CONTRACT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
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
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.arlRiskLevel}
              onChange={(e) => setForm({ ...form, arlRiskLevel: e.target.value })}
            >
              {ARL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  ARL nivel {l}
                </option>
              ))}
            </select>
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
            <Button type="submit" disabled={createMutation.isPending}>
              Crear
            </Button>
          </form>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </Card>
      )}

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Documento</th>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Contrato</th>
              <th>Salario</th>
              <th>Ingreso</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((employee) => (
              <tr key={employee.id} className="border-b border-gray-100">
                <td className="py-2">{employee.documentNumber}</td>
                <td>
                  {employee.firstName} {employee.lastName}
                </td>
                <td>
                  {editingId === employee.id ? (
                    <input
                      className="w-32 rounded border border-gray-200 px-2 py-1"
                      value={editValues.position}
                      onChange={(e) => setEditValues({ ...editValues, position: e.target.value })}
                    />
                  ) : (
                    employee.position
                  )}
                </td>
                <td>{CONTRACT_TYPES.find((c) => c.value === employee.contractType)?.label ?? employee.contractType}</td>
                <td>
                  {editingId === employee.id ? (
                    <input
                      type="number"
                      className="w-28 rounded border border-gray-200 px-2 py-1"
                      value={editValues.baseSalary}
                      onChange={(e) => setEditValues({ ...editValues, baseSalary: e.target.value })}
                    />
                  ) : (
                    formatCOP(employee.baseSalary)
                  )}
                </td>
                <td>{formatDate(employee.hireDate)}</td>
                <td>
                  <span
                    className={
                      employee.status === "ACTIVE" ? "text-green-600" : "text-gray-400"
                    }
                  >
                    {employee.status === "ACTIVE" ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="space-x-2 py-2 text-right">
                  {canUpdate && editingId === employee.id && (
                    <>
                      <Button onClick={() => updateMutation.mutate(employee.id)} disabled={updateMutation.isPending}>
                        Guardar
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </>
                  )}
                  {canUpdate && editingId !== employee.id && employee.status === "ACTIVE" && (
                    <Button variant="secondary" onClick={() => startEdit(employee)}>
                      Editar
                    </Button>
                  )}
                  {canDeactivate && employee.status === "ACTIVE" && deactivatingId !== employee.id && (
                    <Button variant="danger" onClick={() => setDeactivatingId(employee.id)}>
                      Dar de baja
                    </Button>
                  )}
                  {canDeactivate && deactivatingId === employee.id && (
                    <span className="inline-flex items-center gap-2">
                      <input
                        type="date"
                        className="rounded border border-gray-200 px-2 py-1"
                        value={terminationDate}
                        onChange={(e) => setTerminationDate(e.target.value)}
                      />
                      <Button
                        variant="danger"
                        disabled={!terminationDate || deactivateMutation.isPending}
                        onClick={() => deactivateMutation.mutate(employee.id)}
                      >
                        Confirmar
                      </Button>
                      <Button variant="secondary" onClick={() => setDeactivatingId(null)}>
                        Cancelar
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay empleados registrados.</p>}
      </Card>
    </AppLayout>
  );
}
