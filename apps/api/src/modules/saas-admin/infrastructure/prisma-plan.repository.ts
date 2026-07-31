import { basePrisma, Prisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreatePlanData, IPlanRepository, PlanRecord, UpdatePlanData } from "../domain/plan.repository";

function toRecord(row: {
  id: string;
  code: string;
  name: string;
  priceMonthly: unknown;
  priceYearly: unknown;
  maxBranches: number;
  maxUsers: number;
  features: unknown;
  isActive: boolean;
  createdAt: Date;
}): PlanRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    priceMonthly: Number(row.priceMonthly),
    priceYearly: Number(row.priceYearly),
    maxBranches: row.maxBranches,
    maxUsers: row.maxUsers,
    features: row.features as Record<string, unknown>,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

/** basePrisma: Plan no tiene companyId, no es un dato de tenant. */
export class PrismaPlanRepository implements IPlanRepository {
  async create(data: CreatePlanData): Promise<PlanRecord> {
    const row = await basePrisma.plan.create({ data: { ...data, features: data.features as Prisma.InputJsonValue } });
    return toRecord(row);
  }

  async list(): Promise<PlanRecord[]> {
    const rows = await basePrisma.plan.findMany({ orderBy: { priceMonthly: "asc" } });
    return rows.map(toRecord);
  }

  async update(id: string, data: UpdatePlanData): Promise<PlanRecord> {
    await this.findByIdOrThrow(id);
    const row = await basePrisma.plan.update({
      where: { id },
      data: { ...data, features: data.features as Prisma.InputJsonValue | undefined },
    });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<PlanRecord> {
    const row = await basePrisma.plan.findUnique({ where: { id } });
    if (!row) throw new NotFoundError("Plan", id);
    return toRecord(row);
  }

  async findByCode(code: string): Promise<PlanRecord | null> {
    const row = await basePrisma.plan.findUnique({ where: { code } });
    return row ? toRecord(row) : null;
  }
}
