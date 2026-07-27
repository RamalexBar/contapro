import { basePrisma } from "@erp/database";
import type {
  CreateCompanyWithAdminInput,
  CreatedCompanyWithAdmin,
  IUserRepository,
  UserWithAccess,
} from "../domain/user.repository";
import { SYSTEM_ROLES } from "@erp/shared-types";

/**
 * Repositorio de autenticacion. A DIFERENCIA de los demas repositorios del sistema, este usa
 * `basePrisma` (SIN la extension de tenant) porque el login ocurre ANTES de que exista un
 * TenantContext: el email identifica al usuario, no al reves. Una vez autenticado, todo el
 * resto de la app usa el cliente con tenant extension (shared/prisma/prisma-client.ts).
 */
export class PrismaUserRepository implements IUserRepository {
  async findByEmailWithAccess(companyId: string | undefined, email: string): Promise<UserWithAccess | null> {
    const user = await basePrisma.user.findFirst({
      where: { email, ...(companyId ? { companyId } : {}) },
      include: {
        branches: { where: { isDefault: true }, take: 1 },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissions: { include: { permission: true } },
      },
    });
    if (!user) return null;
    return this.toUserWithAccess(user);
  }

  async findByIdWithAccess(userId: string): Promise<UserWithAccess | null> {
    const user = await basePrisma.user.findUnique({
      where: { id: userId },
      include: {
        branches: { where: { isDefault: true }, take: 1 },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissions: { include: { permission: true } },
      },
    });
    if (!user) return null;
    return this.toUserWithAccess(user);
  }

  private toUserWithAccess(user: {
    id: string;
    companyId: string;
    email: string;
    passwordHash: string;
    pinHash: string | null;
    fullName: string;
    isActive: boolean;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    branches: { branchId: string }[];
    roles: { role: { name: string; permissions: { permission: { code: string } }[] } }[];
    permissions: { granted: boolean; permission: { code: string } }[];
  }): UserWithAccess {
    const rolePermissionCodes = new Set<string>();
    const roleNames: string[] = [];
    for (const userRole of user.roles) {
      roleNames.push(userRole.role.name);
      for (const rp of userRole.role.permissions) {
        rolePermissionCodes.add(rp.permission.code);
      }
    }
    for (const override of user.permissions) {
      if (override.granted) rolePermissionCodes.add(override.permission.code);
      else rolePermissionCodes.delete(override.permission.code);
    }

    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      passwordHash: user.passwordHash,
      pinHash: user.pinHash,
      fullName: user.fullName,
      isActive: user.isActive,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      defaultBranchId: user.branches[0]?.branchId ?? null,
      roles: roleNames,
      permissions: Array.from(rolePermissionCodes),
    };
  }

  async registerFailedLogin(userId: string): Promise<void> {
    await basePrisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await basePrisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await basePrisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }

  async createCompanyWithAdmin(input: CreateCompanyWithAdminInput): Promise<CreatedCompanyWithAdmin> {
    return basePrisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: input.companyName,
          legalName: input.legalName,
          nit: input.nit,
          email: input.companyEmail,
        },
      });

      const branch = await tx.branch.create({
        data: { companyId: company.id, name: input.branchName, code: "PRIN", isMain: true },
      });

      let adminRole = await tx.role.findFirst({ where: { name: "ADMINISTRADOR", companyId: null } });
      if (!adminRole) {
        adminRole = await tx.role.create({ data: { name: SYSTEM_ROLES[0], isSystem: true, companyId: null } });
      }

      const admin = await tx.user.create({
        data: {
          companyId: company.id,
          email: input.adminEmail,
          passwordHash: input.adminPasswordHash,
          fullName: input.adminFullName,
        },
      });

      await tx.userBranch.create({ data: { userId: admin.id, branchId: branch.id, isDefault: true } });
      await tx.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

      return { companyId: company.id, branchId: branch.id, adminUserId: admin.id };
    });
  }

  async saveRefreshToken(userId: string, _tokenId: string, tokenHash: string, expiresAt: Date, ip?: string): Promise<void> {
    await basePrisma.refreshToken.create({ data: { userId, tokenHash, expiresAt, createdByIp: ip } });
  }

  async findRefreshToken(tokenHash: string) {
    return basePrisma.refreshToken.findFirst({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await basePrisma.refreshToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
  }
}
