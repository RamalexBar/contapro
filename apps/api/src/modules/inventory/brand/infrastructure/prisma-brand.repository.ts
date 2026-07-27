import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { BrandRecord, IBrandRepository } from "../domain/brand.repository";

export class PrismaBrandRepository implements IBrandRepository {
  async list(): Promise<BrandRecord[]> {
    return prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  async create(name: string): Promise<BrandRecord> {
    return prisma.brand.create({ data: { companyId: getTenantContext().companyId, name } });
  }
}
