import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { round2 } from "@erp/shared-utils";
import { NotFoundError } from "../../../shared/errors/app-error";
import { getTenantContext } from "../../../shared/context/request-context";
import type { EmployeeSettlement } from "../application/benefit-settlement-calculator";
import type {
  ApprovedPayrollTotals,
  BenefitSettlementRecord,
  BenefitSettlementType,
  CreateBenefitSettlementData,
  IBenefitSettlementRepository,
} from "../domain/benefit-settlement.repository";

const VARIABLE_CODES = new Set(["OVERTIME_DAY", "OVERTIME_NIGHT", "NIGHT_SURCHARGE", "SUNDAY_SURCHARGE"]);
const PROVISION_CODES = new Set(["SEVERANCE", "SEVERANCE_INTEREST", "SERVICE_BONUS", "VACATION"]);

type Row = {
  id: string;
  companyId: string;
  employeeId: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  grossTotal: Prisma.Decimal;
  withholding: Prisma.Decimal;
  netPay: Prisma.Decimal;
  toSeveranceFund: Prisma.Decimal;
  detail: Prisma.JsonValue;
  terminationReason: string | null;
  journalEntryId: string | null;
  createdAt: Date;
};

function toRecord(row: Row): BenefitSettlementRecord {
  return {
    ...row,
    type: row.type as BenefitSettlementType,
    grossTotal: Number(row.grossTotal),
    withholding: Number(row.withholding),
    netPay: Number(row.netPay),
    toSeveranceFund: Number(row.toSeveranceFund),
    detail: row.detail as unknown as EmployeeSettlement,
  };
}

export class PrismaBenefitSettlementRepository implements IBenefitSettlementRepository {
  async approvedPayrollTotals(employeeId: string, start: Date, end: Date): Promise<ApprovedPayrollTotals> {
    // PayrollItem no tiene companyId: el aislamiento va por la relacion con Payroll (mismo criterio
    // que prisma-payroll.repository.ts).
    const items = await prisma.payrollItem.findMany({
      where: {
        payrollDetail: {
          employeeId,
          payroll: {
            companyId: getTenantContext().companyId,
            status: { in: ["APPROVED", "PAID"] },
            // Nominas que EMPIEZAN dentro del periodo: la del mes del retiro termina despues de la
            // fecha de retiro (ej. 1-31 dic con retiro el 15) y su provision tambien cuenta.
            startDate: { gte: start, lte: end },
          },
        },
      },
      select: { conceptCode: true, amount: true },
    });
    let variableEarnings = 0;
    const provisions: Record<string, number> = {};
    for (const item of items) {
      const amount = Number(item.amount);
      if (VARIABLE_CODES.has(item.conceptCode)) variableEarnings += amount;
      if (PROVISION_CODES.has(item.conceptCode)) provisions[item.conceptCode] = round2((provisions[item.conceptCode] ?? 0) + amount);
    }
    return { variableEarnings: round2(variableEarnings), provisions };
  }

  async vacationDaysTaken(employeeId: string): Promise<number> {
    // Vacation no tiene companyId: se confirma que el empleado sea de la empresa.
    const employee = await prisma.employee.findFirst({ where: { id: employeeId }, select: { id: true } });
    if (!employee) throw new NotFoundError("Employee", employeeId);
    const rows = await prisma.vacation.findMany({
      where: { employeeId, status: { in: ["APPROVED", "TAKEN"] } },
      select: { daysTaken: true },
    });
    return rows.reduce((sum, r) => sum + r.daysTaken, 0);
  }

  async exists(employeeId: string, type: BenefitSettlementType, periodStart: Date): Promise<boolean> {
    const row = await prisma.benefitSettlement.findFirst({ where: { employeeId, type, periodStart }, select: { id: true } });
    return row !== null;
  }

  async createMany(rows: CreateBenefitSettlementData[], journalEntryId: string | null): Promise<BenefitSettlementRecord[]> {
    const ctx = getTenantContext();
    const created = await prisma.$transaction(
      rows.map((r) =>
        prisma.benefitSettlement.create({
          data: {
            companyId: ctx.companyId,
            employeeId: r.settlement.employeeId,
            type: r.type,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            grossTotal: r.settlement.grossTotal,
            withholding: r.settlement.withholding,
            netPay: r.settlement.netPay,
            toSeveranceFund: r.settlement.toSeveranceFund,
            detail: r.settlement as unknown as Prisma.InputJsonValue,
            terminationReason: r.terminationReason,
            journalEntryId,
            createdByUserId: ctx.userId,
          },
        })
      )
    );
    return created.map(toRecord);
  }

  async list(filter: { type?: BenefitSettlementType; year?: number }): Promise<BenefitSettlementRecord[]> {
    const rows = await prisma.benefitSettlement.findMany({
      where: {
        type: filter.type,
        periodStart: filter.year ? { gte: new Date(Date.UTC(filter.year, 0, 1)), lt: new Date(Date.UTC(filter.year + 1, 0, 1)) } : undefined,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<BenefitSettlementRecord> {
    const row = await prisma.benefitSettlement.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("BenefitSettlement", id);
    return toRecord(row);
  }
}
