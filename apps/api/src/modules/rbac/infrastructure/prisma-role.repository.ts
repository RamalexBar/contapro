import { prisma } from "../../../shared/prisma/prisma-client";
import type { IRoleRepository, RoleWithPermissions } from "../domain/rbac.types";

export class PrismaRoleRepository implements IRoleRepository {
  async list(companyId: string): Promise<RoleWithPermissions[]> {
    const roles = await prisma.role.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
    return roles.map(this.toDomain);
  }

  async create(companyId: string, name: string): Promise<RoleWithPermissions> {
    const role = await prisma.role.create({
      data: { companyId, name, isSystem: false },
      include: { permissions: { include: { permission: true } } },
    });
    return this.toDomain(role);
  }

  async setPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    });
  }

  async findById(roleId: string): Promise<RoleWithPermissions | null> {
    const role = await prisma.role.findFirst({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    return role ? this.toDomain(role) : null;
  }

  private toDomain(role: {
    id: string;
    companyId: string | null;
    name: string;
    isSystem: boolean;
    permissions: { permission: { code: string } }[];
  }): RoleWithPermissions {
    return {
      id: role.id,
      companyId: role.companyId,
      name: role.name,
      isSystem: role.isSystem,
      permissionCodes: role.permissions.map((p) => p.permission.code),
    };
  }
}
