/**
 * PayrollParameter no tiene companyId en el modelo Prisma: es una tabla GLOBAL compartida por
 * todas las empresas del SaaS (la legislacion laboral colombiana es la misma para todas), pensada
 * para que el operador del SaaS (o un Administrador/Contador de cualquier empresa, en esta
 * iteracion) cree una fila nueva cada año sin tocar codigo. Ver payroll.prisma.
 */
export interface PayrollParameterRecord {
  id: string;
  year: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  minimumWage: number;
  transportAllowance: number;
  uvt: number;
  healthEmployeePercent: number;
  healthEmployerPercent: number;
  pensionEmployeePercent: number;
  pensionEmployerPercent: number;
  arlPercentByRiskLevel: Record<string, number>;
  severancePercent: number;
  severanceInterestPercent: number;
  serviceBonusPercent: number;
  vacationPercent: number;
  familyCompensationPercent: number;
  icbfPercent: number;
  senaPercent: number;
  overtimeDayPercent: number;
  overtimeNightPercent: number;
  nightSurchargePercent: number;
  sundayHolidaySurchargePercent: number;
  monthlyHoursDivisor: number;
  isActive: boolean;
}

export type CreatePayrollParameterData = Omit<PayrollParameterRecord, "id" | "isActive">;

export interface IPayrollParameterRepository {
  create(data: CreatePayrollParameterData): Promise<PayrollParameterRecord>;
  list(): Promise<PayrollParameterRecord[]>;
  findByYearOrThrow(year: number): Promise<PayrollParameterRecord>;
}
