import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreatePayrollParameterData,
  IPayrollParameterRepository,
  PayrollParameterRecord,
} from "../domain/payroll-parameter.repository";

type PayrollParameterRow = {
  id: string;
  year: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  minimumWage: Prisma.Decimal;
  transportAllowance: Prisma.Decimal;
  uvt: Prisma.Decimal;
  healthEmployeePercent: Prisma.Decimal;
  healthEmployerPercent: Prisma.Decimal;
  pensionEmployeePercent: Prisma.Decimal;
  pensionEmployerPercent: Prisma.Decimal;
  arlPercentByRiskLevel: Prisma.JsonValue;
  severancePercent: Prisma.Decimal;
  severanceInterestPercent: Prisma.Decimal;
  serviceBonusPercent: Prisma.Decimal;
  vacationPercent: Prisma.Decimal;
  familyCompensationPercent: Prisma.Decimal;
  icbfPercent: Prisma.Decimal;
  senaPercent: Prisma.Decimal;
  overtimeDayPercent: Prisma.Decimal;
  overtimeNightPercent: Prisma.Decimal;
  nightSurchargePercent: Prisma.Decimal;
  sundayHolidaySurchargePercent: Prisma.Decimal;
  monthlyHoursDivisor: Prisma.Decimal;
  isActive: boolean;
};

function toRecord(row: PayrollParameterRow): PayrollParameterRecord {
  return {
    id: row.id,
    year: row.year,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    minimumWage: Number(row.minimumWage),
    transportAllowance: Number(row.transportAllowance),
    uvt: Number(row.uvt),
    healthEmployeePercent: Number(row.healthEmployeePercent),
    healthEmployerPercent: Number(row.healthEmployerPercent),
    pensionEmployeePercent: Number(row.pensionEmployeePercent),
    pensionEmployerPercent: Number(row.pensionEmployerPercent),
    arlPercentByRiskLevel: row.arlPercentByRiskLevel as Record<string, number>,
    severancePercent: Number(row.severancePercent),
    severanceInterestPercent: Number(row.severanceInterestPercent),
    serviceBonusPercent: Number(row.serviceBonusPercent),
    vacationPercent: Number(row.vacationPercent),
    familyCompensationPercent: Number(row.familyCompensationPercent),
    icbfPercent: Number(row.icbfPercent),
    senaPercent: Number(row.senaPercent),
    overtimeDayPercent: Number(row.overtimeDayPercent),
    overtimeNightPercent: Number(row.overtimeNightPercent),
    nightSurchargePercent: Number(row.nightSurchargePercent),
    sundayHolidaySurchargePercent: Number(row.sundayHolidaySurchargePercent),
    monthlyHoursDivisor: Number(row.monthlyHoursDivisor),
    isActive: row.isActive,
  };
}

export class PrismaPayrollParameterRepository implements IPayrollParameterRepository {
  async create(data: CreatePayrollParameterData): Promise<PayrollParameterRecord> {
    try {
      const row = await prisma.payrollParameter.create({ data });
      return toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existen parametros de nomina para el año ${data.year}`);
      }
      throw err;
    }
  }

  async list(): Promise<PayrollParameterRecord[]> {
    const rows = await prisma.payrollParameter.findMany({ orderBy: { year: "desc" } });
    return rows.map(toRecord);
  }

  async findByYearOrThrow(year: number): Promise<PayrollParameterRecord> {
    const row = await prisma.payrollParameter.findFirst({ where: { year, isActive: true } });
    if (!row) throw new NotFoundError("PayrollParameter", String(year));
    return toRecord(row);
  }
}
