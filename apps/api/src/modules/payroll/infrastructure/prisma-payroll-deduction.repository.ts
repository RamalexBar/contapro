import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreatePayrollDeductionData,
  IPayrollDeductionRepository,
  PayrollDeductionRecord,
  PayrollDeductionStatus,
  PayrollDeductionType,
} from "../domain/payroll-deduction.repository";

function toRecord(row: {
  id: string;
  employeeId: string;
  type: string;
  description: string;
  amountPerPeriod: unknown;
  totalAmount: unknown;
  remainingBalance: unknown;
  status: string;
  startDate: Date;
  createdAt: Date;
}): PayrollDeductionRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type as PayrollDeductionType,
    description: row.description,
    amountPerPeriod: Number(row.amountPerPeriod),
    totalAmount: row.totalAmount === null ? null : Number(row.totalAmount),
    remainingBalance: row.remainingBalance === null ? null : Number(row.remainingBalance),
    status: row.status as PayrollDeductionStatus,
    startDate: row.startDate,
    createdAt: row.createdAt,
  };
}

export class PrismaPayrollDeductionRepository implements IPayrollDeductionRepository {
  async create(data: CreatePayrollDeductionData): Promise<PayrollDeductionRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.payrollDeduction.create({
      data: {
        companyId,
        employeeId: data.employeeId,
        type: data.type,
        description: data.description,
        amountPerPeriod: data.amountPerPeriod,
        totalAmount: data.totalAmount,
        // Arranca igual al total (si hay total) -- ver domain/payroll-deduction.repository.ts.
        remainingBalance: data.totalAmount,
        startDate: data.startDate,
        createdByUserId: data.createdByUserId,
      },
    });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<PayrollDeductionRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.payrollDeduction.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("PayrollDeduction", id);
    return toRecord(row);
  }

  async list(filter?: { employeeId?: string; status?: PayrollDeductionStatus }): Promise<PayrollDeductionRecord[]> {
    const rows = await prisma.payrollDeduction.findMany({
      where: { employeeId: filter?.employeeId, status: filter?.status },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async listActiveForEmployee(employeeId: string): Promise<PayrollDeductionRecord[]> {
    const rows = await prisma.payrollDeduction.findMany({ where: { employeeId, status: "ACTIVE" } });
    return rows.map(toRecord);
  }

  async cancel(id: string): Promise<PayrollDeductionRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.payrollDeduction.update({ where: { id }, data: { status: "CANCELLED" } });
    return toRecord(row);
  }

  async applyPeriodAmount(id: string, amount: number): Promise<PayrollDeductionRecord> {
    const current = await this.findByIdOrThrow(id);
    if (current.remainingBalance === null) {
      return current;
    }
    const newBalance = Math.max(0, Math.round((current.remainingBalance - amount) * 100) / 100);
    const row = await prisma.payrollDeduction.update({
      where: { id },
      data: { remainingBalance: newBalance, status: newBalance === 0 ? "COMPLETED" : "ACTIVE" },
    });
    return toRecord(row);
  }
}
