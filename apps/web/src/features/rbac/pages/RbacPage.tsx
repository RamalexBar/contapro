import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  assignRole,
  createRole,
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
          <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{module}</h3>
          <ul className="space-y-1">
            {perms.map((p) => (
              <li key={p.code}>
                <label className="flex items-start gap-2 text-sm text-gray-700">
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
      <h1 className="mb-4 text-lg font-semibold">Roles y permisos</h1>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Roles</h2>
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
          <Button type="submit" disabled={createRoleMutation.isPending}>
            Crear
          </Button>
        </form>

        <div className="space-y-3">
          {roles?.data.map((role) => (
            <div key={role.id} className="rounded-md border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{role.name}</span>{" "}
                  {role.isSystem && <span className="text-xs text-gray-400">(rol de sistema, no editable)</span>}
                  <span className="ml-2 text-xs text-gray-500">{role.permissionCodes.length} permisos</span>
                </div>
                {!role.isSystem &&
                  (editingRoleId === role.id ? (
                    <div className="space-x-2">
                      <Button
                        onClick={() => setPermissionsMutation.mutate(role.id)}
                        disabled={setPermissionsMutation.isPending}
                      >
                        Guardar
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingRoleId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => startEditRole(role.id, role.permissionCodes)}>
                      Editar permisos
                    </Button>
                  ))}
              </div>
              {editingRoleId === role.id && permissions && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <PermissionMatrix permissions={permissions.data} checked={editingCodes} onToggle={toggleEditingCode} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Usuarios y roles</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Nombre</th>
              <th>Correo</th>
              <th>Roles</th>
              <th>Asignar rol</th>
            </tr>
          </thead>
          <tbody>
            {users?.data.map((user) => (
              <tr key={user.id} className="border-b border-gray-100">
                <td className="py-2">{user.fullName}</td>
                <td>{user.email}</td>
                <td className="space-x-1">
                  {user.roles.map((roleName) => {
                    const roleId = roleIdByName.get(roleName);
                    return (
                      <span
                        key={roleName}
                        className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs"
                      >
                        {roleName}
                        {roleId && (
                          <button
                            type="button"
                            className="text-gray-400 hover:text-red-600"
                            onClick={() => removeRoleMutation.mutate({ userId: user.id, roleId })}
                            title="Quitar rol"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    );
                  })}
                </td>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <select
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      value={selectedRoleByUser[user.id] ?? ""}
                      onChange={(e) => setSelectedRoleByUser((prev) => ({ ...prev, [user.id]: e.target.value }))}
                    >
                      <option value="">Seleccionar...</option>
                      {roles?.data.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      disabled={!selectedRoleByUser[user.id] || assignRoleMutation.isPending}
                      onClick={() =>
                        assignRoleMutation.mutate({ userId: user.id, roleId: selectedRoleByUser[user.id]! })
                      }
                    >
                      Asignar
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Permisos individuales (override por usuario)</h2>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Usuario</span>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={overrideUserId}
            onChange={(e) => setOverrideUserId(e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {users?.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email})
              </option>
            ))}
          </select>
        </label>

        {overrideUserId && permissions && effective && (
          <>
            <p className="mb-2 text-xs text-gray-500">
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
