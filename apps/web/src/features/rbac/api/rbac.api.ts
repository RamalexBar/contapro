import { apiFetch } from "../../../lib/api-client";

export interface RoleRecord {
  id: string;
  companyId: string | null;
  name: string;
  isSystem: boolean;
  permissionCodes: string[];
}

export interface PermissionRecord {
  id: string;
  code: string;
  module: string;
  description: string;
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
}

export interface EffectivePermissions {
  roles: string[];
  permissions: string[];
}

export function listRoles(): Promise<{ data: RoleRecord[] }> {
  return apiFetch("/roles");
}

export function createRole(name: string): Promise<RoleRecord> {
  return apiFetch("/roles", { method: "POST", body: { name } });
}

export function setRolePermissions(roleId: string, permissionCodes: string[]): Promise<void> {
  return apiFetch(`/roles/${roleId}/permissions`, { method: "PUT", body: { permissionCodes } });
}

export function listPermissions(): Promise<{ data: PermissionRecord[] }> {
  return apiFetch("/permissions");
}

export function listUsers(): Promise<{ data: UserSummary[] }> {
  return apiFetch("/users");
}

export function createUser(input: { email: string; fullName: string; password: string; roleId?: string }): Promise<UserSummary> {
  return apiFetch("/users", { method: "POST", body: input });
}

export function assignRole(userId: string, roleId: string): Promise<void> {
  return apiFetch(`/users/${userId}/roles`, { method: "POST", body: { roleId } });
}

export function removeRole(userId: string, roleId: string): Promise<void> {
  return apiFetch(`/users/${userId}/roles/${roleId}`, { method: "DELETE" });
}

export function grantUserPermission(userId: string, permissionCode: string, granted: boolean): Promise<void> {
  return apiFetch(`/users/${userId}/permissions`, { method: "PUT", body: { permissionCode, granted } });
}

export function getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
  return apiFetch(`/users/${userId}/effective-permissions`);
}
