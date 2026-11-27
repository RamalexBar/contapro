import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { listEmployees } from "../../employees/api/employee.api";
import { cancelPayrollBonus, createPayrollBonus, listPayrollBonuses } from "../api/payroll.api";

const todayStr = () => new Date().toISOString().slice(0, 10);
const EMPTY = { employeeId: "", date: todayStr(), amount: "", description: "" };

/**
 * Bonificaciones NO salariales (art. 128 CST): entran en la nomina cuyo periodo contiene la fecha. No
 * suman a prestaciones ni parafiscales; solo lo que pase del 40% del devengado cotiza salud y pension.
 */
export function PayrollBonusesCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const { data: bonuses } = useQuery({ queryKey: ["payroll-bonuses"], queryFn: listPayrollBonuses });
  const names = new Map((employees?.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      createPayrollBonus({ employeeId: form.employeeId, date: form.date, amount: Number(form.amount), description: form.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-bonuses"] });
      setForm({ ...EMPTY, date: form.date });
      setShowForm(false);
    },
  });
  const cancel = useMutation({
    mutationFn: cancelPayrollBonus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-bonuses"] }),
  });

  if (!canManage && (bonuses?.data.length ?? 0) === 0) return null;

  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Bonificaciones no salariales</h2>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "Nueva bonificación"}
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Se pagan en la nómina del periodo de su fecha. No son salario: no suman a prima, cesantías, vacaciones ni caja.
        Solo si en el mes superan el 40% de lo devengado, el excedente paga salud y pensión (Ley 1393 de 2010). Deben estar
        pactadas como no salariales en el contrato.
      </p>

      {showForm && canManage && (
        <form
          className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
            <option value="">Empleado</option>
            {/* Tambien retirados: pueden recibirla en su ultima nomina (la API valida la fecha contra el contrato). */}
            {employees?.data.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
                {emp.status === "INACTIVE" ? " (retirado)" : ""}
              </option>
            ))}
          </Select>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <Input type="number" min="1" placeholder="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <Input placeholder="Motivo (ej. bono por metas)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <Button type="submit" loading={create.isPending}>
            Guardar
          </Button>
        </form>
      )}
      {(create.isError || cancel.isError) && (
        <Alert tone="danger" className="mb-3">
          {((create.error ?? cancel.error) as Error).message}
        </Alert>
      )}

      {(bonuses?.data.length ?? 0) > 0 && (
        <Table>
          <TableHead>
            <tr>
              <Th>Fecha</Th>
              <Th>Empleado</Th>
              <Th>Motivo</Th>
              <Th>Valor</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </TableHead>
          <TableBody>
            {bonuses!.data.map((b) => (
              <TableRow key={b.id}>
                <Td>{b.date.slice(0, 10)}</Td>
                <Td>{names.get(b.employeeId) ?? "-"}</Td>
                <Td>{b.description}</Td>
                <Td>{formatCOP(b.amount)}</Td>
                <Td>
                  <Badge tone={b.status === "ACTIVE" ? "success" : "neutral"}>{b.status === "ACTIVE" ? "Activa" : "Cancelada"}</Badge>
                </Td>
                <Td>
                  {canManage && b.status === "ACTIVE" && (
                    <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === b.id} onClick={() => cancel.mutate(b.id)}>
                      Cancelar
                    </Button>
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
