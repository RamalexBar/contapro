import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { IPayrollCommissionReader, PendingCommission } from "../domain/payroll-commission.reader";

export class PrismaPayrollCommissionReader implements IPayrollCommissionReader {
  async pendingForEmployee(employeeId: string, year: number, month: number): Promise<PendingCommission[]> {
    const employee = await prisma.employee.findFirst({ where: { id: employeeId }, select: { userId: true } });
    if (!employee?.userId) return [];
    const rows = await prisma.commissionSettlement.findMany({
      where: { sellerUserId: employee.userId, year, month, status: "CALCULATED" },
      select: { id: true, commissionAmount: true },
    });
    return rows.map((r) => ({ id: r.id, amount: Number(r.commissionAmount) })).filter((r) => r.amount > 0);
  }

  async markPaidInPayroll(ids: string[], payrollId: string): Promise<void> {
    if (ids.length === 0) return;
    await prisma.commissionSettlement.updateMany({
      where: { id: { in: ids }, companyId: getTenantContext().companyId, status: "CALCULATED" },
      data: { status: "PAID", paidAt: new Date(), payrollId },
    });
  }
}
