import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { listUsers } from "../../rbac/api/rbac.api";
import { updateEmployee, type EmployeeRecord } from "../api/employee.api";

/**
 * Con que usuario de Contapro entra cada empleado. Sin este vinculo, el empleado no puede pedir
 * vacaciones, permisos ni incapacidades a su nombre (la pantalla no sabe quien es) ni marcar
 * horario. Un usuario solo puede estar vinculado a un empleado.
 */
export function EmployeeUsersCard({ employees }: { employees: EmployeeRecord[] }) {
  const queryClient = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const mutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string | null }) => updateEmployee(id, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["my-employee"] });
    },
  });

  const active = employees.filter((e) => e.status === "ACTIVE");
  if (active.length === 0) return null;
  const linkedTo = new Map(employees.filter((e) => e.userId).map((e) => [e.userId!, e.id]));

  return (
    <Card title="Usuario de cada empleado" noPadding className="mt-6">
      <p className="px-4 pt-3 text-sm text-slate-500">
        Vincula a cada empleado con el usuario con el que entra a Contapro. Asi puede pedir vacaciones, permisos e incapacidades a su
        nombre. Los usuarios se crean en Configuracion &rarr; Roles y permisos.
      </p>
      <Table>
        <TableHead>
          <tr>
            <Th>Empleado</Th>
            <Th>Usuario de Contapro</Th>
          </tr>
        </TableHead>
        <TableBody>
          {active.map((e) => (
            <TableRow key={e.id}>
              <Td className="font-medium text-slate-900">
                {e.firstName} {e.lastName}
              </Td>
              <Td>
                <Select
                  aria-label={`Usuario de ${e.firstName} ${e.lastName}`}
                  value={e.userId ?? ""}
                  disabled={mutation.isPending}
                  onChange={(ev) => mutation.mutate({ id: e.id, userId: ev.target.value || null })}
                >
                  <option value="">Sin usuario</option>
                  {(users?.data ?? []).map((u) => {
                    const takenBy = linkedTo.get(u.id);
                    return (
                      <option key={u.id} value={u.id} disabled={Boolean(takenBy && takenBy !== e.id)}>
                        {u.fullName} ({u.email}){takenBy && takenBy !== e.id ? " - ya vinculado" : ""}
                      </option>
                    );
                  })}
                </Select>
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {mutation.isError && (
        <div className="p-3">
          <Alert tone="danger">{(mutation.error as Error).message}</Alert>
        </div>
      )}
    </Card>
  );
}
