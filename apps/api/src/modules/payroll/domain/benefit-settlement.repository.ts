import type { EmployeeSettlement } from "../application/benefit-settlement-calculator";

export type BenefitSettlementType = "SERVICE_BONUS" | "SEVERANCE" | "TERMINATION";

export interface BenefitSettlementRecord {
  id: string;
  companyId: string;
  employeeId: string;
  type: BenefitSettlementType;
  periodStart: Date;
  periodEnd: Date;
  grossTotal: number;
  withholding: number;
  netPay: number;
  toSeveranceFund: number;
  detail: EmployeeSettlement;
  terminationReason: string | null;
  journalEntryId: string | null;
  createdAt: Date;
}

export interface CreateBenefitSettlementData {
  type: BenefitSettlementType;
  periodStart: Date;
  periodEnd: Date;
  settlement: EmployeeSettlement;
  terminationReason: string | null;
}

/** Sumas de las nominas APROBADAS o PAGADAS de un empleado que empiezan dentro de [start, end]. */
export interface ApprovedPayrollTotals {
  variableEarnings: number;
  provisions: Record<string, number>;
}

export interface IBenefitSettlementRepository {
  approvedPayrollTotals(employeeId: string, start: Date, end: Date): Promise<ApprovedPayrollTotals>;
  /** Dias de vacaciones aprobadas o tomadas (Vacation.daysTaken). */
  vacationDaysTaken(employeeId: string): Promise<number>;
  exists(employeeId: string, type: BenefitSettlementType, periodStart: Date): Promise<boolean>;
  createMany(rows: CreateBenefitSettlementData[], journalEntryId: string | null): Promise<BenefitSettlementRecord[]>;
  list(filter: { type?: BenefitSettlementType; year?: number }): Promise<BenefitSettlementRecord[]>;
  findByIdOrThrow(id: string): Promise<BenefitSettlementRecord>;
}
