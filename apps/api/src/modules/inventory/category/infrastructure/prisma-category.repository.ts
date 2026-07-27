import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { CategoryRecord, ICategoryRepository } from "../domain/category.repository";

export class PrismaCategoryRepository implements ICategoryRepository {
  async list(): Promise<CategoryRecord[]> {
    return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  async create(name: string, parentId?: string): Promise<CategoryRecord> {
    return prisma.category.create({ data: { companyId: getTenantContext().companyId, name, parentId } });
  }

  async findById(id: string): Promise<CategoryRecord | null> {
    return prisma.category.findFirst({ where: { id } });
  }
}
