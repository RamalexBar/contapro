import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CommissionSettlementRecord,
  CommissionSettlementStatus,
  ICommissionSettlementRepository,
  ListSettlementsFilter,
  MarkPaidData,
  UpsertSettlementForPeriodData,
} from "../domain/commission-settlement.repository";

type SettlementRow = {
  id: string;
  sellerUserId: string;
  year: number;
  month: number;
  salesBase: Prisma.Decimal;
  ratePercent: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  status: string;
  calculatedAt: Date;
  paidAt: Date | null;
  journalEntryId: string | null;
};

function toRecord(row: SettlementRow): CommissionSettlementRecord {
  return {
    id: row.id,
    sellerUserId: row.sellerUserId,
    year: row.year,
    month: row.month,
    salesBase: Number(row.salesBase),
    ratePercent: Number(row.ratePercent),
    commissionAmount: Number(row.commissionAmount),
    status: row.status as CommissionSettlementStatus,
    calculatedAt: row.calculatedAt,
    paidAt: row.paidAt,
    journalEntryId: row.journalEntryId,
  };
}

export class PrismaCommissionSettlementRepository implements ICommissionSettlementRepository {
  async upsertForPeriod(data: UpsertSettlementForPeriodData): Promise<CommissionSettlementRecord | null> {
    const companyId = getTenantContext().companyId;
    return prisma.$transaction(async (tx) => {
      const existing = await tx.commissionSettlement.findFirst({
        where: { companyId, sellerUserId: data.sellerUserId, year: data.year, month: data.month },
      });
      if (existing && existing.status === "PAID") return null;

      const row = existing
        ? await tx.commissionSettlement.update({
            where: { id: existing.id },
            data: {
              salesBase: data.salesBase,
              ratePercent: data.ratePercent,
              commissionAmount: data.commissionAmount,
              calculatedAt: new Date(),
            },
          })
        : await tx.commissionSettlement.create({
            data: {
              companyId,
              sellerUserId: data.sellerUserId,
              year: data.year,
              month: data.month,
              salesBase: data.salesBase,
              ratePercent: data.ratePercent,
              commissionAmount: data.commissionAmount,
            },
          });
      return toRecord(row);
    });
  }

  async list(filter?: ListSettlementsFilter): Promise<CommissionSettlementRecord[]> {
    const rows = await prisma.commissionSettlement.findMany({
      where: { year: filter?.year, month: filter?.month, status: filter?.status },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<CommissionSettlementRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.commissionSettlement.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("CommissionSettlement", id);
    return toRecord(row);
  }

  async markPaid(id: string, data: MarkPaidData): Promise<CommissionSettlementRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.commissionSettlement.update({
      where: { id },
      data: { status: "PAID", paidAt: data.paidAt, journalEntryId: data.journalEntryId },
    });
    return toRecord(row);
  }
}
