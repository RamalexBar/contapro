import { round2 } from "@erp/shared-utils";
import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { PayrollParameterRecord } from "../domain/payroll-parameter.repository";
import { salaryWithholdingTax } from "./payroll-calculator";

/**
 * Prestaciones sociales que se PAGAN (la nomina mensual solo las provisiona, ver payroll-calculator.ts):
 * prima de servicios semestral, consolidacion anual de cesantias e intereses, y liquidacion del
 * contrato al retiro (cesantias, intereses, prima proporcional, vacaciones pendientes e indemnizacion).
 *
 * Simplificaciones documentadas en el README del modulo:
 * - La base es el salario ACTUAL + auxilio de transporte (si le aplica) + el promedio mensual de lo
 *   variable (horas extra y recargos) de las nominas aprobadas del periodo. El CST (art. 253) pide el
 *   promedio del ultimo año si el salario cambio en los ultimos 3 meses: en ese caso revise el valor.
 * - No descuenta licencias no remuneradas ni suspensiones del contrato (no se registran todavia).
 */

export type BenefitConcept = "SERVICE_BONUS" | "SEVERANCE" | "SEVERANCE_INTEREST" | "VACATION" | "INDEMNITY";

export type TerminationReason = "RESIGNATION" | "JUST_CAUSE" | "WITHOUT_JUST_CAUSE" | "END_OF_TERM" | "MUTUAL_AGREEMENT";

export interface BenefitLine {
  concept: BenefitConcept;
  label: string;
  days: number;
  base: number;
  amount: number;
  /** Lo que ya se habia provisionado en las nominas aprobadas para este concepto y periodo. */
  provisioned: number;
}

export interface EmployeeSettlement {
  employeeId: string;
  employeeName: string;
  documentNumber: string;
  periodStart: string;
  periodEnd: string;
  lines: BenefitLine[];
  grossTotal: number;
  withholding: number;
  netPay: number;
  /** Cesantias que van al fondo (consolidacion anual), no al trabajador. */
  toSeveranceFund: number;
  notes: string[];
}

/** Lo que el repositorio junta de las nominas aprobadas de un empleado en el periodo. */
export interface EmployeePeriodData {
  /** Suma de horas extra y recargos (OVERTIME_*, NIGHT_SURCHARGE, SUNDAY_SURCHARGE). */
  variableEarnings: number;
  /** Suma de provisiones por concepto (SEVERANCE, SEVERANCE_INTEREST, SERVICE_BONUS, VACATION). */
  provisions: Partial<Record<string, number>>;
}

const DAY_MS = 86_400_000;

function utcParts(date: Date) {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function isLastDayOfFebruary(date: Date): boolean {
  return date.getUTCMonth() === 1 && new Date(date.getTime() + DAY_MS).getUTCMonth() === 2;
}

/**
 * Dias entre dos fechas (ambas incluidas) en año comercial de 360 dias / meses de 30, como se liquidan
 * las prestaciones en Colombia. El 31 cuenta como 30 y el ultimo dia de febrero como 30.
 */
export function days360(start: Date, end: Date): number {
  if (end.getTime() < start.getTime()) return 0;
  const a = utcParts(start);
  const b = utcParts(end);
  const d1 = Math.min(a.d, 30);
  const d2 = isLastDayOfFebruary(end) ? 30 : Math.min(b.d, 30);
  return (b.y - a.y) * 360 + (b.m - a.m) * 30 + (d2 - d1) + 1;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}
function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/** Base mensual para prima y cesantias: salario + auxilio de transporte (si le aplica) + promedio variable. */
export function benefitsMonthlyBase(employee: EmployeeRecord, parameter: PayrollParameterRecord, variableEarnings: number, days: number): number {
  const transport = employee.baseSalary <= 2 * parameter.minimumWage ? parameter.transportAllowance : 0;
  const months = days / 30;
  const averageVariable = months > 0 ? variableEarnings / months : 0;
  return round2(employee.baseSalary + transport + averageVariable);
}

/** Prima de servicios (art. 306 CST): base x dias del semestre / 360. */
export function serviceBonusLine(
  employee: EmployeeRecord,
  parameter: PayrollParameterRecord,
  periodStart: Date,
  periodEnd: Date,
  data: EmployeePeriodData
): BenefitLine | null {
  if (employee.salaryType === "INTEGRAL") return null;
  const start = maxDate(periodStart, employee.hireDate);
  const end = employee.terminationDate ? minDate(periodEnd, employee.terminationDate) : periodEnd;
  const days = days360(start, end);
  if (days <= 0) return null;
  const base = benefitsMonthlyBase(employee, parameter, data.variableEarnings, days);
  return {
    concept: "SERVICE_BONUS",
    label: "Prima de servicios",
    days,
    base,
    amount: round2((base * days) / 360),
    provisioned: round2(data.provisions.SERVICE_BONUS ?? 0),
  };
}

/** Cesantias (art. 249 CST) e intereses (Ley 52 de 1975: 12% anual, proporcional a los dias). */
export function severanceLines(
  employee: EmployeeRecord,
  parameter: PayrollParameterRecord,
  periodStart: Date,
  periodEnd: Date,
  data: EmployeePeriodData
): BenefitLine[] {
  if (employee.salaryType === "INTEGRAL") return [];
  const start = maxDate(periodStart, employee.hireDate);
  const end = employee.terminationDate ? minDate(periodEnd, employee.terminationDate) : periodEnd;
  const days = days360(start, end);
  if (days <= 0) return [];
  const base = benefitsMonthlyBase(employee, parameter, data.variableEarnings, days);
  const severance = round2((base * days) / 360);
  const interest = round2((severance * days * 0.12) / 360);
  return [
    { concept: "SEVERANCE", label: "Cesantias", days, base, amount: severance, provisioned: round2(data.provisions.SEVERANCE ?? 0) },
    {
      concept: "SEVERANCE_INTEREST",
      label: "Intereses sobre cesantias",
      days,
      base: severance,
      amount: interest,
      provisioned: round2(data.provisions.SEVERANCE_INTEREST ?? 0),
    },
  ];
}

/**
 * Vacaciones pendientes compensadas en dinero al retiro (art. 189 CST): 15 dias habiles por cada año
 * de servicio, proporcional, menos los dias ya tomados; se pagan con el salario ordinario (sin
 * auxilio de transporte ni horas extra).
 */
export function vacationLine(employee: EmployeeRecord, terminationDate: Date, daysTaken: number, provisioned: number): BenefitLine | null {
  const daysWorked = days360(employee.hireDate, terminationDate);
  const earned = (daysWorked * 15) / 360;
  const pending = round2(Math.max(0, earned - daysTaken));
  if (pending <= 0) return null;
  return {
    concept: "VACATION",
    label: `Vacaciones pendientes (${pending} dias: ${round2(earned)} causados - ${daysTaken} tomados)`,
    days: pending,
    base: employee.baseSalary,
    amount: round2((employee.baseSalary / 30) * pending),
    provisioned: round2(provisioned),
  };
}

/**
 * Indemnizacion por despido sin justa causa (art. 64 CST):
 * - Termino indefinido, salario < 10 SMMLV: 30 dias por el primer año y 20 por cada año adicional
 *   (proporcional); salario >= 10 SMMLV: 20 dias por el primer año y 15 por cada adicional.
 * - Termino fijo: los salarios del tiempo que faltaba para terminar el contrato.
 * Solo aplica cuando el motivo es WITHOUT_JUST_CAUSE.
 */
export function indemnityLine(
  employee: EmployeeRecord,
  parameter: PayrollParameterRecord,
  terminationDate: Date,
  reason: TerminationReason,
  fixedTermEndDate: Date | null
): BenefitLine | null {
  if (reason !== "WITHOUT_JUST_CAUSE") return null;
  const dailySalary = employee.baseSalary / 30;
  let days: number;
  if (employee.contractType === "FIXED_TERM") {
    if (!fixedTermEndDate) return null;
    days = days360(new Date(terminationDate.getTime() + DAY_MS), fixedTermEndDate);
  } else {
    const years = days360(employee.hireDate, terminationDate) / 360;
    const high = employee.baseSalary >= 10 * parameter.minimumWage;
    const first = high ? 20 : 30;
    const extra = high ? 15 : 20;
    days = years <= 1 ? first : first + extra * (years - 1);
  }
  days = round2(days);
  if (days <= 0) return null;
  return {
    concept: "INDEMNITY",
    label: "Indemnizacion por despido sin justa causa (art. 64 CST)",
    days,
    base: employee.baseSalary,
    amount: round2(dailySalary * days),
    provisioned: 0,
  };
}

/**
 * Parte exenta de cesantias e intereses (art. 206 num. 4 E.T.) segun el salario mensual promedio en UVT.
 */
export function severanceExemptPercent(averageMonthlySalaryUvt: number): number {
  if (averageMonthlySalaryUvt <= 350) return 100;
  if (averageMonthlySalaryUvt <= 410) return 90;
  if (averageMonthlySalaryUvt <= 470) return 80;
  if (averageMonthlySalaryUvt <= 530) return 60;
  if (averageMonthlySalaryUvt <= 590) return 40;
  if (averageMonthlySalaryUvt <= 650) return 20;
  return 0;
}

/**
 * Retencion en la fuente sobre lo que se le paga al trabajador:
 * - Prima, vacaciones y la parte gravada de cesantias/intereses: procedimiento 1 sobre ese valor
 *   (con la renta exenta del 25%). Se calcula sobre el pago solo; si coincide con un salario alto en
 *   el mismo mes, el contador puede ajustar la retencion del mes.
 * - Indemnizacion: 20% si el salario es mayor a 10 SMMLV (art. 401-3 E.T.); si no, no tiene retencion.
 */
export function settlementWithholding(
  employee: EmployeeRecord,
  parameter: PayrollParameterRecord,
  lines: BenefitLine[],
  severancePaidToEmployee: boolean
): number {
  const averageSalaryUvt = parameter.uvt > 0 ? employee.baseSalary / parameter.uvt : 0;
  const severanceTaxablePercent = 100 - severanceExemptPercent(averageSalaryUvt);
  let taxable = 0;
  for (const line of lines) {
    if (line.concept === "SERVICE_BONUS" || line.concept === "VACATION") taxable += line.amount;
    if (line.concept === "SEVERANCE_INTEREST" || (line.concept === "SEVERANCE" && severancePaidToEmployee)) {
      taxable += (line.amount * severanceTaxablePercent) / 100;
    }
  }
  let withholding = taxable > 0 ? salaryWithholdingTax(taxable, 0, parameter.uvt) : 0;
  const indemnity = lines.find((l) => l.concept === "INDEMNITY");
  if (indemnity && employee.baseSalary > 10 * parameter.minimumWage) {
    withholding += Math.round((indemnity.amount * 0.2) / 1000) * 1000;
  }
  return withholding;
}

export function buildSettlement(
  employee: EmployeeRecord,
  periodStart: Date,
  periodEnd: Date,
  lines: BenefitLine[],
  withholding: number,
  options: { severanceToFund: boolean; notes?: string[] }
): EmployeeSettlement {
  const grossTotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  // En la consolidacion anual las cesantias se consignan al fondo (art. 99 Ley 50 de 1990), no se le
  // pagan al trabajador; en la liquidacion del contrato si se le pagan directamente.
  const toSeveranceFund = options.severanceToFund
    ? round2(lines.filter((l) => l.concept === "SEVERANCE").reduce((sum, l) => sum + l.amount, 0))
    : 0;
  return {
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    documentNumber: employee.documentNumber,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    lines,
    grossTotal,
    withholding,
    netPay: round2(grossTotal - toSeveranceFund - withholding),
    toSeveranceFund,
    notes: options.notes ?? [],
  };
}
