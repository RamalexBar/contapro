import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreateUserInput, IUserDirectoryRepository, UserSummary } from "../domain/rbac.types";

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

  async emailExists(email: string): Promise<boolean> {
    const existing = await prisma.user.findFirst({ where: { email } });
    return existing !== null;
  }

  /** Vincula al usuario nuevo a la sucursal principal de la empresa (como isDefault) -- mismo
   * patron que RegisterCompanyUseCase usa para el primer administrador, necesario para que
   * cualquier flujo tenant-scoped que dependa de branchId (POS, caja) tenga con que trabajar. */
  async create(input: CreateUserInput): Promise<UserSummary> {
    const mainBranch = await prisma.branch.findFirst({ where: { isMain: true } });
    if (!mainBranch) throw new NotFoundError("Branch", "isMain");

    const user = await prisma.user.create({
      data: {
        companyId: getTenantContext().companyId,
        email: input.email,
        fullName: input.fullName,
        passwordHash: input.passwordHash,
      },
    });
    await prisma.userBranch.create({ data: { userId: user.id, branchId: mainBranch.id, isDefault: true } });
    if (input.roleId) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: input.roleId } });
    }

    return { id: user.id, email: user.email, fullName: user.fullName, isActive: user.isActive, roles: [] };
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
