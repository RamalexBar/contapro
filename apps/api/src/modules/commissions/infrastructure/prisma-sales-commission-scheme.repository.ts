import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateSalesCommissionSchemeData,
  ISalesCommissionSchemeRepository,
  SalesCommissionSchemeRecord,
  UpdateSalesCommissionSchemeData,
} from "../domain/sales-commission-scheme.repository";

export class PrismaSalesCommissionSchemeRepository implements ISalesCommissionSchemeRepository {
  async create(data: CreateSalesCommissionSchemeData): Promise<SalesCommissionSchemeRecord> {
    try {
      const row = await prisma.salesCommissionScheme.create({
        data: {
          companyId: getTenantContext().companyId,
          sellerUserId: data.sellerUserId,
          ratePercent: data.ratePercent,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("Ya existe un esquema de comision para este vendedor");
      }
      throw err;
    }
  }

  async list(): Promise<SalesCommissionSchemeRecord[]> {
    const rows = await prisma.salesCommissionScheme.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(this.toRecord);
  }

  async findByIdOrThrow(id: string): Promise<SalesCommissionSchemeRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.salesCommissionScheme.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("SalesCommissionScheme", id);
    return this.toRecord(row);
  }

  async update(id: string, data: UpdateSalesCommissionSchemeData): Promise<SalesCommissionSchemeRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.salesCommissionScheme.update({ where: { id }, data: { ratePercent: data.ratePercent } });
    return this.toRecord(row);
  }

  async deactivate(id: string): Promise<SalesCommissionSchemeRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.salesCommissionScheme.update({ where: { id }, data: { isActive: false } });
    return this.toRecord(row);
  }

  async listActive(): Promise<SalesCommissionSchemeRecord[]> {
    const rows = await prisma.salesCommissionScheme.findMany({ where: { isActive: true } });
    return rows.map(this.toRecord);
  }

  private toRecord(row: { id: string; sellerUserId: string; ratePercent: Prisma.Decimal; isActive: boolean }): SalesCommissionSchemeRecord {
    return {
      id: row.id,
      sellerUserId: row.sellerUserId,
      ratePercent: Number(row.ratePercent),
      isActive: row.isActive,
    };
  }
}
