import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { CompanyRecord } from "../domain/company-reader.repository";
import type { PayslipDocumentRecord } from "../domain/payroll.repository";

/** Forma de PayslipDocument.summaryJson tal como la produce payroll-calculator.ts. */
interface PayrollSummaryJson {
  employeeName?: string;
  period?: { startDate?: string; endDate?: string };
  daysWorked?: number;
  workedDays?: number;
  devengados?: {
    salary?: number;
    transportAllowance?: number;
    overtimeDay?: number;
    overtimeNight?: number;
    nightSurcharge?: number;
    sundaySurcharge?: number;
    vacationPay?: number;
    sickLeaveEmployer?: number;
    sickLeaveEps?: number;
    workInjuryArl?: number;
    maternityLeave?: number;
    paternityLeave?: number;
    total?: number;
  };
  novedades?: {
    vacationBusinessDays?: number;
    sickLeaveDays?: number;
    workInjuryDays?: number;
    maternityDays?: number;
    paternityDays?: number;
    unpaidDays?: number;
  };
  deducciones?: {
    health?: number;
    pension?: number;
    solidarityFund?: number;
    withholdingTax?: number;
    adicionales?: Array<{ id: string; type: string; description: string; amount: number }>;
    total?: number;
  };
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
  /** Dia en que se paga: el ultimo dia del periodo (15 o fin de mes en nomina quincenal). */
  paymentDate: Date | null;
  /** "Primera quincena de noviembre de 2026", "Segunda quincena de ...", o "Noviembre de 2026". */
  periodLabel: string;
  daysWorked: number;
  /** Dias efectivamente trabajados (sin vacaciones, incapacidades ni licencias). */
  workedDays: number;
  /** "Vacaciones 5 d, Incapacidad 3 d" (vacio si no hubo novedades). */
  noveltiesLabel: string;
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
  vacationPay: "Vacaciones disfrutadas",
  sickLeaveEmployer: "Incapacidad (dias 1 y 2, empleador)",
  sickLeaveEps: "Incapacidad (EPS)",
  workInjuryArl: "Incapacidad laboral (ARL)",
  maternityLeave: "Licencia de maternidad",
  paternityLeave: "Licencia de paternidad",
};

const DEDUCTION_LABELS: Record<string, string> = {
  health: "Salud (empleado)",
  pension: "Pension (empleado)",
  solidarityFund: "Fondo de solidaridad pensional",
  withholdingTax: "Retencion en la fuente",
};

function toLines(source: Record<string, number | undefined> | undefined, labels: Record<string, string>): PayslipPdfLine[] {
  if (!source) return [];
  return Object.entries(labels)
    .filter(([key]) => (source[key] ?? 0) !== 0)
    .map(([key, label]) => ({ label, amount: source[key] ?? 0 }));
}

/** Resumen de novedades del periodo, en dias. */
export function noveltiesLabel(novedades: PayrollSummaryJson["novedades"]): string {
  if (!novedades) return "";
  const parts: Array<[string, number | undefined]> = [
    ["Vacaciones", novedades.vacationBusinessDays],
    ["Incapacidad", novedades.sickLeaveDays],
    ["Incapacidad laboral", novedades.workInjuryDays],
    ["Licencia de maternidad", novedades.maternityDays],
    ["Licencia de paternidad", novedades.paternityDays],
    ["Dias no remunerados", novedades.unpaidDays],
  ];
  return parts.filter(([, d]) => (d ?? 0) > 0).map(([label, d]) => `${label} ${d} d`).join(", ");
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Nombre del periodo para el desprendible: quincena 1 (1-15), quincena 2 (16-fin de mes) o mes completo. */
export function payslipPeriodLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) return "";
  const month = `${MONTHS[end.getUTCMonth()]} de ${end.getUTCFullYear()}`;
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (spanDays <= 16 && start.getUTCDate() === 1) return `Primera quincena de ${month}`;
  if (spanDays <= 16 && start.getUTCDate() === 16) return `Segunda quincena de ${month}`;
  return month.charAt(0).toUpperCase() + month.slice(1);
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
    paymentDate: summary.period?.endDate ? new Date(summary.period.endDate) : null,
    periodLabel: payslipPeriodLabel(
      summary.period?.startDate ? new Date(summary.period.startDate) : null,
      summary.period?.endDate ? new Date(summary.period.endDate) : null
    ),
    daysWorked: summary.daysWorked ?? 0,
    workedDays: summary.workedDays ?? summary.daysWorked ?? 0,
    noveltiesLabel: noveltiesLabel(summary.novedades),
    earnings: toLines(summary.devengados, EARNING_LABELS),
    grossTotal: summary.devengados?.total ?? 0,
    deductions: [
      ...toLines(
        {
          health: summary.deducciones?.health,
          pension: summary.deducciones?.pension,
          solidarityFund: summary.deducciones?.solidarityFund,
          withholdingTax: summary.deducciones?.withholdingTax,
        },
        DEDUCTION_LABELS
      ),
      ...(summary.deducciones?.adicionales ?? []).map((d) => ({
        label: d.type === "LOAN_DEDUCTION" ? `Libranza: ${d.description}` : `Embargo: ${d.description}`,
        amount: d.amount,
      })),
    ],
    totalDeductions: summary.deducciones?.total ?? 0,
    netPay: summary.netPay ?? 0,
    generatedAt: payslip.generatedAt,
  };
}
