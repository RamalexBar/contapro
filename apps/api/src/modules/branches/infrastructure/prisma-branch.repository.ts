import { prisma } from "../../../shared/prisma/prisma-client";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { BranchRecord, CreateBranchData, IBranchRepository, UpdateBranchData } from "../domain/branch.repository";

const SELECT = { id: true, name: true, code: true, address: true, phone: true, isMain: true, isActive: true } as const;

export class PrismaBranchRepository implements IBranchRepository {
  async list(companyId: string, options: { includeInactive?: boolean } = {}): Promise<BranchRecord[]> {
    return prisma.branch.findMany({
      where: { companyId, ...(options.includeInactive ? {} : { isActive: true }) },
      select: SELECT,
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
    });
  }

  async findById(companyId: string, id: string): Promise<BranchRecord | null> {
    return prisma.branch.findFirst({ where: { companyId, id }, select: SELECT });
  }

  async countActive(companyId: string): Promise<number> {
    return prisma.branch.count({ where: { companyId, isActive: true } });
  }

  async existsByCode(companyId: string, code: string): Promise<boolean> {
    const found = await prisma.branch.findUnique({ where: { companyId_code: { companyId, code } }, select: { id: true } });
    return found !== null;
  }

  async create(companyId: string, data: CreateBranchData): Promise<BranchRecord> {
    return prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: { companyId, name: data.name, code: data.code, address: data.address, phone: data.phone, isMain: false },
        select: SELECT,
      });
      await tx.cashRegister.create({ data: { companyId, branchId: branch.id, code: "CAJA1", name: `Caja ${branch.name}` } });
      return branch;
    });
  }

  async update(companyId: string, id: string, data: UpdateBranchData): Promise<BranchRecord> {
    await this.findOrThrow(companyId, id);
    return prisma.branch.update({ where: { id }, data, select: SELECT });
  }

  async hasOpenCashSession(branchId: string): Promise<boolean> {
    const open = await prisma.cashSession.findFirst({ where: { status: "OPEN", cashRegister: { branchId } }, select: { id: true } });
    return open !== null;
  }

  async deactivate(companyId: string, id: string): Promise<BranchRecord> {
    await this.findOrThrow(companyId, id);
    const main = await prisma.branch.findFirst({ where: { companyId, isMain: true }, select: { id: true } });
    if (!main) throw new NotFoundError("Branch", "isMain");

    return prisma.$transaction(async (tx) => {
      const links = await tx.userBranch.findMany({ where: { branchId: id } });
      await tx.userBranch.deleteMany({ where: { branchId: id } });
      for (const link of links) {
        const remaining = await tx.userBranch.findMany({ where: { userId: link.userId } });
        if (remaining.length === 0) {
          await tx.userBranch.create({ data: { userId: link.userId, branchId: main.id, isDefault: true } });
        } else if (link.isDefault && !remaining.some((r) => r.isDefault)) {
          const next = remaining.find((r) => r.branchId === main.id) ?? remaining[0]!;
          await tx.userBranch.update({ where: { userId_branchId: { userId: next.userId, branchId: next.branchId } }, data: { isDefault: true } });
        }
      }
      await tx.cashRegister.updateMany({ where: { branchId: id }, data: { isActive: false } });
      return tx.branch.update({ where: { id }, data: { isActive: false }, select: SELECT });
    });
  }

  async reactivate(companyId: string, id: string): Promise<BranchRecord> {
    await this.findOrThrow(companyId, id);
    return prisma.$transaction(async (tx) => {
      await tx.cashRegister.updateMany({ where: { branchId: id }, data: { isActive: true } });
      return tx.branch.update({ where: { id }, data: { isActive: true }, select: SELECT });
    });
  }

  private async findOrThrow(companyId: string, id: string): Promise<BranchRecord> {
    const branch = await this.findById(companyId, id);
    if (!branch) throw new NotFoundError("Branch", id);
    return branch;
  }
}
