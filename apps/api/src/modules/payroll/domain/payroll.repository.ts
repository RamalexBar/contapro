export interface PayrollRecord {
  id: string;
  companyId: string;
  branchId: string | null;
  year: number;
  month: number;
  periodType: string;
  startDate: Date;
  endDate: Date;
  status: string;
  createdByUserId: string;
  calculatedAt: Date | null;
  paidAt: Date | null;
}

export interface PayrollItemRecord {
  id: string;
  conceptCode: string;
  quantity: number | null;
  rate: number | null;
  amount: number;
  payrollDeductionId: string | null;
}

export interface PayrollDetailRecord {
  id: string;
  employeeId: string;
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
  employerCostTotal: number;
  status: string;
  items: PayrollItemRecord[];
  payslip: { id: string; generatedAt: Date; fileUrl: string | null; summaryJson: Record<string, unknown> } | null;
}

export interface PayslipDocumentRecord {
  id: string;
  payrollDetailId: string;
  generatedAt: Date;
  fileUrl: string | null;
  summaryJson: Record<string, unknown>;
}

export interface PayrollWithDetails extends PayrollRecord {
  details: PayrollDetailRecord[];
}

export interface CreatePayrollData {
  branchId?: string;
  year: number;
  month: number;
  periodType: string;
  startDate: Date;
  endDate: Date;
  createdByUserId: string;
}

export interface PayrollItemCalc {
  conceptCode: string;
  quantity?: number;
  rate?: number;
  amount: number;
  /** Presente si el item viene de una PayrollDeduction (libranza/embargo) -- ver
   * applyPeriodAmount en payroll-deduction.repository.ts. */
  payrollDeductionId?: string;
}

export interface EmployeeCalculationResult {
  employeeId: string;
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
  employerCostTotal: number;
  items: PayrollItemCalc[];
  /** Desglose legible para PayslipDocument.summaryJson (el PDF queda para despues, ver modelo). */
  summary: Record<string, unknown>;
}

export interface IPayrollRepository {
  create(data: CreatePayrollData): Promise<PayrollRecord>;
  findByIdOrThrow(id: string): Promise<PayrollRecord>;
  findWithDetailsOrThrow(id: string): Promise<PayrollWithDetails>;
  findPayslipByIdOrThrow(id: string): Promise<PayslipDocumentRecord>;
  list(filter?: { year?: number; branchId?: string }): Promise<PayrollRecord[]>;
  /** Transaccional: borra el detalle previo (si es un recalculo) y persiste el nuevo. */
  saveCalculationResults(payrollId: string, results: EmployeeCalculationResult[]): Promise<void>;
  updateStatus(id: string, status: string, extra?: { calculatedAt?: Date; paidAt?: Date }): Promise<PayrollRecord>;
}
