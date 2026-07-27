export interface UserWithAccess {
  id: string;
  companyId: string;
  email: string;
  passwordHash: string;
  pinHash: string | null;
  fullName: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  defaultBranchId: string | null;
  roles: string[];
  permissions: string[]; // union resuelta: permisos por rol + overrides individuales
}

export interface CreateCompanyWithAdminInput {
  companyName: string;
  legalName: string;
  nit: string;
  companyEmail: string;
  branchName: string;
  adminFullName: string;
  adminEmail: string;
  adminPasswordHash: string;
}

export interface CreatedCompanyWithAdmin {
  companyId: string;
  branchId: string;
  adminUserId: string;
}

export interface IUserRepository {
  findByEmailWithAccess(companyId: string | undefined, email: string): Promise<UserWithAccess | null>;
  findByIdWithAccess(userId: string): Promise<UserWithAccess | null>;
  registerFailedLogin(userId: string): Promise<void>;
  resetFailedLogins(userId: string): Promise<void>;
  updateLastLogin(userId: string): Promise<void>;
  createCompanyWithAdmin(input: CreateCompanyWithAdminInput): Promise<CreatedCompanyWithAdmin>;
  saveRefreshToken(userId: string, tokenId: string, tokenHash: string, expiresAt: Date, ip?: string): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: Date; revokedAt: Date | null } | null>;
  revokeRefreshToken(tokenId: string): Promise<void>;
}
