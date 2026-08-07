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
import {
  assignRole,
  createRole,
  createUser,
  getEffectivePermissions,
  grantUserPermission,
  listPermissions,
  listRoles,
  listUsers,
  removeRole,
  setRolePermissions,
  type PermissionRecord,
} from "../api/rbac.api";

function groupByModule(permissions: PermissionRecord[]): [string, PermissionRecord[]][] {
  const groups = new Map<string, PermissionRecord[]>();
  for (const p of permissions) {
    const list = groups.get(p.module) ?? [];
    list.push(p);
    groups.set(p.module, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function PermissionMatrix({
  permissions,
  checked,
  onToggle,
  disabled,
}: {
  permissions: PermissionRecord[];
  checked: Set<string>;
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groupByModule(permissions).map(([module, perms]) => (
        <div key={module}>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">{module}</h3>
          <ul className="space-y-1">
            {perms.map((p) => (
              <li key={p.code}>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked.has(p.code)}
                    disabled={disabled}
                    onChange={() => onToggle(p.code)}
                  />
                  <span title={p.code}>{p.description}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function RbacPage() {
  const queryClient = useQueryClient();
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const { data: permissions } = useQuery({ queryKey: ["permissions"], queryFn: listPermissions });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const roleIdByName = new Map((roles?.data ?? []).map((r) => [r.name, r.id]));

  const [newRoleName, setNewRoleName] = useState("");
  const createRoleMutation = useMutation({
    mutationFn: () => createRole(newRoleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setNewRoleName("");
    },
  });

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingCodes, setEditingCodes] = useState<Set<string>>(new Set());
  const setPermissionsMutation = useMutation({
    mutationFn: (roleId: string) => setRolePermissions(roleId, Array.from(editingCodes)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setEditingRoleId(null);
    },
  });

  function startEditRole(roleId: string, currentCodes: string[]) {
    setEditingRoleId(roleId);
    setEditingCodes(new Set(currentCodes));
  }

  function toggleEditingCode(code: string) {
    setEditingCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const [newUser, setNewUser] = useState({ fullName: "", email: "", password: "", roleId: "" });
  const createUserMutation = useMutation({
    mutationFn: () =>
      createUser({
        fullName: newUser.fullName,
        email: newUser.email,
        password: newUser.password,
        roleId: newUser.roleId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ fullName: "", email: "", password: "", roleId: "" });
    },
  });

  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, string>>({});
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => assignRole(userId, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => removeRole(userId, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const [overrideUserId, setOverrideUserId] = useState("");
  const { data: effective } = useQuery({
    queryKey: ["effective-permissions", overrideUserId],
    queryFn: () => getEffectivePermissions(overrideUserId),
    enabled: Boolean(overrideUserId),
  });
  const grantMutation = useMutation({
    mutationFn: ({ code, granted }: { code: string; granted: boolean }) =>
      grantUserPermission(overrideUserId, code, granted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["effective-permissions", overrideUserId] }),
  });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Roles y permisos</h1>

      <Card title="Roles" className="mb-6">
        <form
          className="mb-4 flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createRoleMutation.mutate();
          }}
        >
          <Input
            label="Nuevo rol"
            placeholder="Nombre del rol"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            required
          />
          <Button type="submit" loading={createRoleMutation.isPending}>
            Crear
          </Button>
        </form>

        <div className="space-y-3">
          {roles?.data.map((role) => (
            <div key={role.id} className="rounded-md border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{role.name}</span>{" "}
                  {role.isSystem && <span className="text-xs text-slate-400">(rol de sistema, no editable)</span>}
                  <span className="ml-2 text-xs text-slate-500">{role.permissionCodes.length} permisos</span>
                </div>
                {!role.isSystem &&
                  (editingRoleId === role.id ? (
                    <div className="space-x-2">
                      <Button size="sm" loading={setPermissionsMutation.isPending} onClick={() => setPermissionsMutation.mutate(role.id)}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingRoleId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => startEditRole(role.id, role.permissionCodes)}>
                      Editar permisos
                    </Button>
                  ))}
              </div>
              {editingRoleId === role.id && permissions && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <PermissionMatrix permissions={permissions.data} checked={editingCodes} onToggle={toggleEditingCode} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Nuevo usuario" className="mb-6">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            createUserMutation.mutate();
          }}
        >
          <Input
            placeholder="Nombre completo"
            value={newUser.fullName}
            onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
            required
          />
          <Input
            type="email"
            placeholder="Correo"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña (min. 8 caracteres)"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            minLength={8}
            required
          />
          <Select value={newUser.roleId} onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}>
            <option value="">Sin rol (asignar despues)</option>
            {roles?.data.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={createUserMutation.isPending}>
            Crear usuario
          </Button>
        </form>
        {createUserMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(createUserMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card title="Usuarios y roles" noPadding className="mb-6">
        <Table>
          <TableHead>
            <tr>
              <Th>Nombre</Th>
              <Th>Correo</Th>
              <Th>Roles</Th>
              <Th>Asignar rol</Th>
            </tr>
          </TableHead>
          <TableBody>
            {users?.data.map((user) => (
              <TableRow key={user.id}>
                <Td>{user.fullName}</Td>
                <Td>{user.email}</Td>
                <Td className="space-x-1">
                  {user.roles.map((roleName) => {
                    const roleId = roleIdByName.get(roleName);
                    return (
                      <span key={roleName} className="inline-flex items-center gap-1">
                        <Badge tone="neutral">
                          {roleName}
                          {roleId && (
                            <button
                              type="button"
                              className="ml-1 text-slate-400 hover:text-danger-600"
                              onClick={() => removeRoleMutation.mutate({ userId: user.id, roleId })}
                              title="Quitar rol"
                            >
                              &times;
                            </button>
                          )}
                        </Badge>
                      </span>
                    );
                  })}
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <Select
                      value={selectedRoleByUser[user.id] ?? ""}
                      onChange={(e) => setSelectedRoleByUser((prev) => ({ ...prev, [user.id]: e.target.value }))}
                    >
                      <option value="">Seleccionar...</option>
                      {roles?.data.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!selectedRoleByUser[user.id]}
                      loading={assignRoleMutation.isPending}
                      onClick={() => assignRoleMutation.mutate({ userId: user.id, roleId: selectedRoleByUser[user.id]! })}
                    >
                      Asignar
                    </Button>
                  </span>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card title="Permisos individuales (override por usuario)">
        <Select label="Usuario" value={overrideUserId} onChange={(e) => setOverrideUserId(e.target.value)} className="mb-3">
          <option value="">Seleccionar...</option>
          {users?.data.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.email})
            </option>
          ))}
        </Select>

        {overrideUserId && permissions && effective && (
          <>
            <p className="mb-2 text-xs text-slate-500">
              Roles: {effective.roles.join(", ") || "ninguno"}. Los permisos marcados abajo reflejan el conjunto
              efectivo (rol + overrides). Desmarcar/marcar crea un override individual para este usuario.
            </p>
            <PermissionMatrix
              permissions={permissions.data}
              checked={new Set(effective.permissions)}
              onToggle={(code) => grantMutation.mutate({ code, granted: !effective.permissions.includes(code) })}
            />
          </>
        )}
      </Card>
    </AppLayout>
  );
}
