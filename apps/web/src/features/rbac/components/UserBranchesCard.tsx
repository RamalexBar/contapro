import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { listBranches } from "../../inventory/api/branch.api";
import { setUserBranches, type UserSummary } from "../api/rbac.api";

interface Draft {
  branchIds: string[];
  defaultBranchId: string;
}

/**
 * En que sucursales trabaja cada usuario. La "principal" de cada uno (por defecto) es donde entra
 * al iniciar sesion y donde vende y abre caja; con varias asignadas, cambia desde la barra superior.
 */
export function UserBranchesCard({ users }: { users: UserSummary[] }) {
  const queryClient = useQueryClient();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ branchIds: [], defaultBranchId: "" });

  const saveMutation = useMutation({
    mutationFn: () => setUserBranches(editingUserId!, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUserId(null);
    },
  });

  const allBranches = branches?.data ?? [];
  if (allBranches.length < 2) {
    return (
      <Card title="Sucursales de cada usuario" className="mb-6">
        <p className="text-sm text-slate-500">
          La empresa tiene una sola sucursal, asi que todos trabajan en ella. Crea mas sucursales en Inventario &rarr; Sucursales.
        </p>
      </Card>
    );
  }

  function startEdit(user: UserSummary) {
    saveMutation.reset();
    setEditingUserId(user.id);
    const current = user.branches.map((b) => b.id);
    setDraft({
      branchIds: current,
      defaultBranchId: user.branches.find((b) => b.isDefault)?.id ?? current[0] ?? "",
    });
  }

  function toggle(branchId: string) {
    setDraft((prev) => {
      const branchIds = prev.branchIds.includes(branchId) ? prev.branchIds.filter((id) => id !== branchId) : [...prev.branchIds, branchId];
      const defaultBranchId = branchIds.includes(prev.defaultBranchId) ? prev.defaultBranchId : (branchIds[0] ?? "");
      return { branchIds, defaultBranchId };
    });
  }

  return (
    <Card title="Sucursales de cada usuario" noPadding className="mb-6">
      <p className="px-4 pt-3 text-sm text-slate-500">
        La sucursal principal de cada usuario es donde entra, vende y abre caja. Si tiene varias, cambia desde la barra de arriba.
      </p>
      <Table>
        <TableHead>
          <tr>
            <Th>Usuario</Th>
            <Th>Sucursales</Th>
            <Th />
          </tr>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <Td className="align-top font-medium text-slate-900">{user.fullName}</Td>
              <Td>
                {editingUserId === user.id ? (
                  <div className="space-y-2">
                    {allBranches.map((b) => {
                      const checked = draft.branchIds.includes(b.id);
                      return (
                        <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={checked} onChange={() => toggle(b.id)} />
                            {b.name}
                          </label>
                          {checked && (
                            <label className="flex items-center gap-1.5 text-xs text-slate-500">
                              <input
                                type="radio"
                                name={`default-${user.id}`}
                                checked={draft.defaultBranchId === b.id}
                                onChange={() => setDraft((prev) => ({ ...prev, defaultBranchId: b.id }))}
                              />
                              principal
                            </label>
                          )}
                        </div>
                      );
                    })}
                    {saveMutation.isError && <Alert tone="danger">{(saveMutation.error as Error).message}</Alert>}
                  </div>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {user.branches.map((b) => (
                      <Badge key={b.id} tone={b.isDefault ? "info" : "neutral"}>
                        {b.name}
                        {b.isDefault && user.branches.length > 1 ? " (principal)" : ""}
                      </Badge>
                    ))}
                  </span>
                )}
              </Td>
              <Td className="whitespace-nowrap text-right align-top">
                {editingUserId === user.id ? (
                  <span className="inline-flex gap-2">
                    <Button size="sm" disabled={draft.branchIds.length === 0} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                      Guardar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingUserId(null)}>
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => startEdit(user)}>
                    Cambiar
                  </Button>
                )}
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
