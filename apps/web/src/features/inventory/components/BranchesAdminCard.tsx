import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { listAllBranches, updateBranch, type BranchRecord } from "../api/branch.api";

/**
 * Editar datos de las sucursales, desactivarlas (sus usuarios pasan a la principal; exige la caja
 * cerrada) o reactivarlas (cuenta contra el limite del plan). La principal no se desactiva.
 */
export function BranchesAdminCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["branches", "all"], queryFn: listAllBranches });
  const [editing, setEditing] = useState<{ id: string; name: string; address: string; phone: string } | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBranch>[1] }) => updateBranch(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "my-branches"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditing(null);
      setConfirmDeactivateId(null);
    },
  });

  const branches = data?.data ?? [];

  function startEdit(b: BranchRecord) {
    mutation.reset();
    setConfirmDeactivateId(null);
    setEditing({ id: b.id, name: b.name, address: b.address ?? "", phone: b.phone ?? "" });
  }

  return (
    <Card title="Sucursales" noPadding>
      <Table>
        <TableHead>
          <tr>
            <Th>Sucursal</Th>
            <Th>Direccion</Th>
            <Th>Telefono</Th>
            <Th>Estado</Th>
            <Th />
          </tr>
        </TableHead>
        <TableBody>
          {branches.map((b) =>
            editing?.id === b.id ? (
              <TableRow key={b.id}>
                <Td>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </Td>
                <Td>
                  <Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
                </Td>
                <Td>
                  <Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                </Td>
                <Td />
                <Td className="whitespace-nowrap text-right">
                  <span className="inline-flex gap-2">
                    <Button
                      size="sm"
                      disabled={editing.name.trim().length < 2}
                      loading={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          id: b.id,
                          input: { name: editing.name.trim(), address: editing.address.trim() || null, phone: editing.phone.trim() || null },
                        })
                      }
                    >
                      Guardar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </span>
                </Td>
              </TableRow>
            ) : (
              <TableRow key={b.id}>
                <Td className="font-medium text-slate-900">
                  {b.name}
                  {b.isMain && <span className="ml-1 text-xs font-normal text-slate-400">(principal)</span>}
                </Td>
                <Td>{b.address ?? "-"}</Td>
                <Td>{b.phone ?? "-"}</Td>
                <Td>{b.isActive ? <Badge tone="success">Activa</Badge> : <Badge tone="neutral">Desactivada</Badge>}</Td>
                <Td className="whitespace-nowrap text-right">
                  {confirmDeactivateId === b.id ? (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                      Sus usuarios pasan a la principal.
                      <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate({ id: b.id, input: { isActive: false } })}>
                        Desactivar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmDeactivateId(null)}>
                        No
                      </Button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(b)}>
                        Editar
                      </Button>
                      {!b.isMain &&
                        (b.isActive ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              mutation.reset();
                              setEditing(null);
                              setConfirmDeactivateId(b.id);
                            }}
                          >
                            Desactivar
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" loading={mutation.isPending} onClick={() => mutation.mutate({ id: b.id, input: { isActive: true } })}>
                            Reactivar
                          </Button>
                        ))}
                    </span>
                  )}
                </Td>
              </TableRow>
            )
          )}
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
