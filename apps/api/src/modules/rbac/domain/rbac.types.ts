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

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
}

export interface IUserDirectoryRepository {
  list(): Promise<UserSummary[]>;
  assignRole(companyId: string, userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
}
