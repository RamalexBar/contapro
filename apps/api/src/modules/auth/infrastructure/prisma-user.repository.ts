import { basePrisma } from "@erp/database";
import type {
  CompanyMatch,
  CreateCompanyWithAdminInput,
  CreatedCompanyWithAdmin,
  IUserRepository,
  UserWithAccess,
} from "../domain/user.repository";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from "@erp/shared-types";

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

  async findCompaniesByEmail(email: string): Promise<CompanyMatch[]> {
    const users = await basePrisma.user.findMany({
      where: { email },
      select: { companyId: true, company: { select: { name: true } } },
    });
    return users.map((u) => ({ companyId: u.companyId, companyName: u.company.name }));
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

      // Autosanacion: el rol ADMINISTRADOR global se crea (arriba) o se reusa, pero antes de este
      // fix nunca quedaba garantizado que tuviera sus permisos por defecto -- si `db:seed:production`
      // nunca se corrio contra esta base antes del primer registro, el rol quedaba creado vacio
      // (isSystem:true pero SIN RolePermission), y CUALQUIER empresa que se registrara despues
      // heredaba ese mismo rol roto (findFirst lo encuentra "existente" y nunca vuelve a intentar
      // poblarlo). Se corrige aqui mismo, en cada registro, no solo cuando el rol es nuevo: si el
      // rol ya existe pero le faltan permisos, este mismo bloque lo completa -- asi el proximo
      // registro despues de este ya no arrastra el problema. Barato en el caso sano (una sola
      // query de conteo) porque el desajuste solo pasa una vez en la vida de la base de datos.
      const adminPermissionCodes = DEFAULT_ROLE_PERMISSIONS.ADMINISTRADOR;
      const existingRolePermissionCount = await tx.rolePermission.count({ where: { roleId: adminRole.id } });
      if (existingRolePermissionCount < adminPermissionCodes.length) {
        for (const permission of PERMISSIONS) {
          if (!(adminPermissionCodes as readonly string[]).includes(permission.code)) continue;
          await tx.permission.upsert({
            where: { code: permission.code },
            create: permission,
            update: {},
          });
        }
        const permissions = await tx.permission.findMany({ where: { code: { in: adminPermissionCodes } } });
        for (const permission of permissions) {
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
            create: { roleId: adminRole.id, permissionId: permission.id },
            update: {},
          });
        }
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

      // Sin esto ninguna empresa nueva puede abrir caja: no existia ningun flujo (UI ni script)
      // para crear CashRegister -- la unica que tenia una era la demo, insertada a mano en algun
      // momento del desarrollo. Mismo criterio que la sucursal principal: se crea una por defecto.
      await tx.cashRegister.create({
        data: { companyId: company.id, branchId: branch.id, code: "CAJA1", name: "Caja principal" },
      });

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

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await basePrisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await basePrisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
