import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  CostCenterRecord,
  CreateCostCenterData,
  ICostCenterRepository,
  UpdateCostCenterData,
} from "../domain/cost-center.repository";

export class PrismaCostCenterRepository implements ICostCenterRepository {
  async create(data: CreateCostCenterData): Promise<CostCenterRecord> {
    try {
      const row = await prisma.costCenter.create({
        data: {
          companyId: getTenantContext().companyId,
          code: data.code,
          name: data.name,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe un centro de costo con el codigo ${data.code}`);
      }
      throw err;
    }
  }

  async list(): Promise<CostCenterRecord[]> {
    const rows = await prisma.costCenter.findMany({ orderBy: { code: "asc" } });
    return rows.map(this.toRecord);
  }

  async findByIdOrThrow(id: string): Promise<CostCenterRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.costCenter.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("CostCenter", id);
    return this.toRecord(row);
  }

  async update(id: string, data: UpdateCostCenterData): Promise<CostCenterRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.costCenter.update({ where: { id }, data: { name: data.name } });
    return this.toRecord(row);
  }

  async deactivate(id: string): Promise<CostCenterRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.costCenter.update({ where: { id }, data: { isActive: false } });
    return this.toRecord(row);
  }

  private toRecord(row: { id: string; code: string; name: string; isActive: boolean }): CostCenterRecord {
    return { id: row.id, code: row.code, name: row.name, isActive: row.isActive };
  }
}
