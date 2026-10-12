export interface RoleWithPermissions {
  id: string;
  companyId: string | null;
  name: string;
  isSystem: boolean;
  permissionCodes: string[];
}

export interface PermissionInfo {
  id: string;
  code: string;
  module: string;
  description: string;
}

export interface IRoleRepository {
  list(companyId: string): Promise<RoleWithPermissions[]>;
  create(companyId: string, name: string): Promise<RoleWithPermissions>;
  setPermissions(roleId: string, permissionIds: string[]): Promise<void>;
  findById(roleId: string): Promise<RoleWithPermissions | null>;
}

export interface IPermissionRepository {
  listAll(): Promise<PermissionInfo[]>;
  findByCodes(codes: string[]): Promise<PermissionInfo[]>;
}

export interface UserBranchSummary {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  /** Sucursales donde trabaja; la `isDefault` es con la que entra al iniciar sesion. */
  branches: UserBranchSummary[];
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  passwordHash: string;
  roleId?: string;
  /** Sucursal del usuario nuevo; sin ella, la principal. */
  branchId?: string;
}

export interface IUserDirectoryRepository {
  list(): Promise<UserSummary[]>;
  create(input: CreateUserInput): Promise<UserSummary>;
  emailExists(email: string): Promise<boolean>;
  assignRole(companyId: string, userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
  /** Reemplaza las sucursales del usuario. El llamador ya valido que existen y estan activas. */
  setBranches(userId: string, branchIds: string[], defaultBranchId: string): Promise<UserSummary>;
  /** Sucursales activas de la empresa con esos ids (para validar antes de asignar). */
  findActiveBranches(branchIds: string[]): Promise<{ id: string; name: string }[]>;
}
