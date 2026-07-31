import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { FinancialPeriodRecord, IFinancialPeriodRepository } from "../domain/financial-period.repository";

function toRecord(row: { id: string; year: number; month: number; status: string; closedAt: Date | null }): FinancialPeriodRecord {
  return { id: row.id, year: row.year, month: row.month, status: row.status as "OPEN" | "CLOSED", closedAt: row.closedAt };
}

export class PrismaFinancialPeriodRepository implements IFinancialPeriodRepository {
  async list(year?: number): Promise<FinancialPeriodRecord[]> {
    const companyId = getTenantContext().companyId;
    const rows = await prisma.financialPeriod.findMany({
      where: { companyId, year },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rows.map(toRecord);
  }

  async findClosed(year: number, month: number): Promise<FinancialPeriodRecord | null> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.financialPeriod.findFirst({ where: { companyId, year, month, status: "CLOSED" } });
    return row ? toRecord(row) : null;
  }

  async close(year: number, month: number): Promise<FinancialPeriodRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.financialPeriod.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      create: { companyId, year, month, status: "CLOSED", closedAt: new Date() },
      update: { status: "CLOSED", closedAt: new Date() },
    });
    return toRecord(row);
  }

  async reopen(year: number, month: number): Promise<FinancialPeriodRecord> {
    const companyId = getTenantContext().companyId;
    const existing = await prisma.financialPeriod.findFirst({ where: { companyId, year, month } });
    if (!existing) throw new NotFoundError("FinancialPeriod", `${year}-${month}`);
    const row = await prisma.financialPeriod.update({
      where: { id: existing.id },
      data: { status: "OPEN", closedAt: null },
    });
    return toRecord(row);
  }
}
