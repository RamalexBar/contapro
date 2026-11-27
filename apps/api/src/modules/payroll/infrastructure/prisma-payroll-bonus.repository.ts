import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreatePayrollBonusData, IPayrollBonusRepository, PayrollBonusRecord } from "../domain/payroll-bonus.repository";

function toRecord(row: {
  id: string;
  employeeId: string;
  date: Date;
  amount: unknown;
  description: string;
  status: string;
  createdAt: Date;
}): PayrollBonusRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: row.date,
    amount: Number(row.amount),
    description: row.description,
    status: row.status as PayrollBonusRecord["status"],
    createdAt: row.createdAt,
  };
}

export class PrismaPayrollBonusRepository implements IPayrollBonusRepository {
  async create(data: CreatePayrollBonusData): Promise<PayrollBonusRecord> {
    const row = await prisma.payrollBonus.create({ data: { ...data, companyId: getTenantContext().companyId } });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<PayrollBonusRecord> {
    const row = await prisma.payrollBonus.findFirst({ where: { id, companyId: getTenantContext().companyId } });
    if (!row) throw new NotFoundError("Bonificacion no encontrada");
    return toRecord(row);
  }

  async list(filter: { employeeId?: string } = {}): Promise<PayrollBonusRecord[]> {
    const rows = await prisma.payrollBonus.findMany({
      where: { employeeId: filter.employeeId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return rows.map(toRecord);
  }

  async listActiveForPeriod(employeeId: string, from: Date, to: Date): Promise<PayrollBonusRecord[]> {
    const rows = await prisma.payrollBonus.findMany({
      where: { employeeId, status: "ACTIVE", date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
    return rows.map(toRecord);
  }

  async isInClosedPayroll(bonus: PayrollBonusRecord): Promise<boolean> {
    const count = await prisma.payrollDetail.count({
      where: {
        employeeId: bonus.employeeId,
        payroll: { status: { in: ["APPROVED", "PAID"] }, startDate: { lte: bonus.date }, endDate: { gte: bonus.date } },
      },
    });
    return count > 0;
  }

  async cancel(id: string): Promise<PayrollBonusRecord> {
    await this.findByIdOrThrow(id);
    await prisma.payrollBonus.updateMany({ where: { id, companyId: getTenantContext().companyId }, data: { status: "CANCELLED" } });
    return this.findByIdOrThrow(id);
  }
}
