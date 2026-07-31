import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { CompanyRecord } from "../domain/company-reader.repository";
import type { PayslipDocumentRecord } from "../domain/payroll.repository";

/** Forma de PayslipDocument.summaryJson tal como la produce payroll-calculator.ts. */
interface PayrollSummaryJson {
  employeeName?: string;
  period?: { startDate?: string; endDate?: string };
  daysWorked?: number;
  devengados?: {
    salary?: number;
    transportAllowance?: number;
    overtimeDay?: number;
    overtimeNight?: number;
    nightSurcharge?: number;
    sundaySurcharge?: number;
    total?: number;
  };
  deducciones?: { health?: number; pension?: number; total?: number };
  netPay?: number;
}

export interface PayslipPdfLine {
  label: string;
  amount: number;
}

/**
 * Forma de datos para el PDF del desprendible de pago (documento interno para el empleado, NO el
 * RIDE de nomina electronica DIAN -- ver pdfkit-ride-renderer.ts en electronic-invoicing para ese
 * otro documento). Se arma desde PayslipDocument.summaryJson (ya calculado), no se recalcula nada.
 */
export interface PayslipPdfData {
  company: { name: string; nit: string };
  employee: {
    fullName: string;
    documentType: string;
    documentNumber: string;
    position: string;
    contractType: string;
  };
  periodStart: Date | null;
  periodEnd: Date | null;
  daysWorked: number;
  earnings: PayslipPdfLine[];
  grossTotal: number;
  deductions: PayslipPdfLine[];
  totalDeductions: number;
  netPay: number;
  generatedAt: Date;
}

const EARNING_LABELS: Record<string, string> = {
  salary: "Salario",
  transportAllowance: "Auxilio de transporte",
  overtimeDay: "Horas extra diurnas",
  overtimeNight: "Horas extra nocturnas",
  nightSurcharge: "Recargo nocturno",
  sundaySurcharge: "Recargo dominical/festivo",
};

const DEDUCTION_LABELS: Record<string, string> = {
  health: "Salud (empleado)",
  pension: "Pension (empleado)",
};

function toLines(source: Record<string, number | undefined> | undefined, labels: Record<string, string>): PayslipPdfLine[] {
  if (!source) return [];
  return Object.entries(labels)
    .filter(([key]) => (source[key] ?? 0) !== 0)
    .map(([key, label]) => ({ label, amount: source[key] ?? 0 }));
}

export function mapToPayslipPdfData(
  payslip: PayslipDocumentRecord,
  employee: EmployeeRecord,
  company: CompanyRecord
): PayslipPdfData {
  const summary = payslip.summaryJson as PayrollSummaryJson;

  return {
    company: { name: company.name, nit: company.nit },
    employee: {
      fullName: summary.employeeName ?? `${employee.firstName} ${employee.lastName}`,
      documentType: employee.documentType,
      documentNumber: employee.documentNumber,
      position: employee.position,
      contractType: employee.contractType,
    },
    periodStart: summary.period?.startDate ? new Date(summary.period.startDate) : null,
    periodEnd: summary.period?.endDate ? new Date(summary.period.endDate) : null,
    daysWorked: summary.daysWorked ?? 0,
    earnings: toLines(summary.devengados, EARNING_LABELS),
    grossTotal: summary.devengados?.total ?? 0,
    deductions: toLines(summary.deducciones, DEDUCTION_LABELS),
    totalDeductions: summary.deducciones?.total ?? 0,
    netPay: summary.netPay ?? 0,
    generatedAt: payslip.generatedAt,
  };
}
