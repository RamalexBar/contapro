import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreateUserInput, IUserDirectoryRepository, UserSummary } from "../domain/rbac.types";

const USER_INCLUDE = {
  roles: { include: { role: true } },
  branches: { include: { branch: { select: { id: true, name: true, isActive: true } } } },
} as const;

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: { role: { name: string } }[];
  branches: { isDefault: boolean; branch: { id: string; name: string; isActive: boolean } }[];
};

function toSummary(u: UserRow): UserSummary {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    isActive: u.isActive,
    roles: u.roles.map((r) => r.role.name),
    branches: u.branches
      .filter((b) => b.branch.isActive)
      .map((b) => ({ id: b.branch.id, name: b.branch.name, isDefault: b.isDefault }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)),
  };
}

export class PrismaUserDirectoryRepository implements IUserDirectoryRepository {
  async list(): Promise<UserSummary[]> {
    const users = await prisma.user.findMany({ include: USER_INCLUDE, orderBy: { fullName: "asc" } });
    return users.map(toSummary);
  }

  async emailExists(email: string): Promise<boolean> {
    const existing = await prisma.user.findFirst({ where: { email } });
    return existing !== null;
  }

  /** Vincula al usuario nuevo a la sucursal elegida (o a la principal) como isDefault -- mismo
   * patron que RegisterCompanyUseCase usa para el primer administrador, necesario para que
   * cualquier flujo tenant-scoped que dependa de branchId (POS, caja) tenga con que trabajar. */
  async create(input: CreateUserInput): Promise<UserSummary> {
    const mainBranch = input.branchId
      ? await prisma.branch.findFirst({ where: { id: input.branchId, isActive: true } })
      : await prisma.branch.findFirst({ where: { isMain: true } });
    if (!mainBranch) throw new NotFoundError("Branch", input.branchId ?? "isMain");

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

    const created = await prisma.user.findFirstOrThrow({ where: { id: user.id }, include: USER_INCLUDE });
    return toSummary(created);
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

  /** `UserBranch` no tiene companyId: se confirma primero que el usuario es de la empresa. */
  async setBranches(userId: string, branchIds: string[], defaultBranchId: string): Promise<UserSummary> {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundError("User", userId);

    await prisma.$transaction(async (tx) => {
      await tx.userBranch.deleteMany({ where: { userId } });
      await tx.userBranch.createMany({
        data: branchIds.map((branchId) => ({ userId, branchId, isDefault: branchId === defaultBranchId })),
      });
    });

    const updated = await prisma.user.findFirstOrThrow({ where: { id: userId }, include: USER_INCLUDE });
    return toSummary(updated);
  }

  async findActiveBranches(branchIds: string[]): Promise<{ id: string; name: string }[]> {
    return prisma.branch.findMany({ where: { id: { in: branchIds }, isActive: true }, select: { id: true, name: true } });
  }
}
