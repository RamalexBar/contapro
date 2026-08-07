import { Prisma } from "@erp/database";
import { round2 } from "@erp/shared-utils";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateFixedAssetData,
  FixedAssetRecord,
  IFixedAssetRepository,
  UpdateFixedAssetData,
} from "../domain/fixed-asset.repository";

type FixedAssetRow = {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  purchaseDate: Date;
  cost: Prisma.Decimal;
  salvageValue: Prisma.Decimal;
  usefulLifeMonths: number;
  accumulatedDepreciation: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
};

function toRecord(row: FixedAssetRow): FixedAssetRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    name: row.name,
    description: row.description,
    purchaseDate: row.purchaseDate,
    cost: Number(row.cost),
    salvageValue: Number(row.salvageValue),
    usefulLifeMonths: row.usefulLifeMonths,
    accumulatedDepreciation: Number(row.accumulatedDepreciation),
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export class PrismaFixedAssetRepository implements IFixedAssetRepository {
  async create(data: CreateFixedAssetData): Promise<FixedAssetRecord> {
    const row = await prisma.fixedAsset.create({
      data: {
        companyId: getTenantContext().companyId,
        branchId: data.branchId,
        name: data.name,
        description: data.description,
        purchaseDate: data.purchaseDate,
        cost: data.cost,
        salvageValue: data.salvageValue ?? 0,
        usefulLifeMonths: data.usefulLifeMonths,
      },
    });
    return toRecord(row);
  }

  async list(): Promise<FixedAssetRecord[]> {
    const rows = await prisma.fixedAsset.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<FixedAssetRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.fixedAsset.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("FixedAsset", id);
    return toRecord(row);
  }

  async update(id: string, data: UpdateFixedAssetData): Promise<FixedAssetRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.fixedAsset.update({ where: { id }, data: { name: data.name, description: data.description } });
    return toRecord(row);
  }

  async deactivate(id: string): Promise<FixedAssetRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.fixedAsset.update({ where: { id }, data: { isActive: false } });
    return toRecord(row);
  }

  async listActive(): Promise<FixedAssetRecord[]> {
    const rows = await prisma.fixedAsset.findMany({ where: { isActive: true } });
    return rows.map(toRecord);
  }

  async incrementAccumulatedDepreciation(id: string, amount: number): Promise<FixedAssetRecord> {
    const current = await this.findByIdOrThrow(id);
    const row = await prisma.fixedAsset.update({
      where: { id },
      data: { accumulatedDepreciation: round2(current.accumulatedDepreciation + amount) },
    });
    return toRecord(row);
  }
}
