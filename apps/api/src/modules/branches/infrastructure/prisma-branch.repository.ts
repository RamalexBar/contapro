import { prisma } from "../../../shared/prisma/prisma-client";
import type { BranchRecord, CreateBranchData, IBranchRepository } from "../domain/branch.repository";

const SELECT = { id: true, name: true, code: true, address: true, phone: true, isMain: true, isActive: true } as const;

export class PrismaBranchRepository implements IBranchRepository {
  async list(companyId: string): Promise<BranchRecord[]> {
    return prisma.branch.findMany({ where: { companyId, isActive: true }, select: SELECT, orderBy: { name: "asc" } });
  }

  async countActive(companyId: string): Promise<number> {
    return prisma.branch.count({ where: { companyId, isActive: true } });
  }

  async existsByCode(companyId: string, code: string): Promise<boolean> {
    const found = await prisma.branch.findUnique({ where: { companyId_code: { companyId, code } }, select: { id: true } });
    return found !== null;
  }

  async create(companyId: string, data: CreateBranchData): Promise<BranchRecord> {
    return prisma.branch.create({
      data: { companyId, name: data.name, code: data.code, address: data.address, phone: data.phone, isMain: false },
      select: SELECT,
    });
  }
}
