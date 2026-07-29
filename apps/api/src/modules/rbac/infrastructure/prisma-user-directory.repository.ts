import { prisma } from "../../../shared/prisma/prisma-client";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { IUserDirectoryRepository, UserSummary } from "../domain/rbac.types";

export class PrismaUserDirectoryRepository implements IUserDirectoryRepository {
  async list(): Promise<UserSummary[]> {
    const users = await prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { fullName: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      roles: u.roles.map((r) => r.role.name),
    }));
  }

  /** `Role` no esta en TENANT_MODELS (roles de sistema son companyId null), se valida a mano. */
  async assignRole(companyId: string, userId: string, roleId: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundError("User", userId);
    const role = await prisma.role.findFirst({ where: { id: roleId, OR: [{ companyId }, { companyId: null }] } });
    if (!role) throw new NotFoundError("Role", roleId);

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundError("User", userId);
    await prisma.userRole.deleteMany({ where: { userId, roleId } });
  }
}
