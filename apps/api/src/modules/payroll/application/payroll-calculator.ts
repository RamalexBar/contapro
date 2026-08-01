import { COMPANY_TIMEZONE, isColombianHoliday, round2 } from "@erp/shared-utils";
import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { TimeEntryRecord } from "../../timetracking/domain/timetracking.repository";
import type { PayrollDeductionRecord } from "../domain/payroll-deduction.repository";
import type { PayrollParameterRecord } from "../domain/payroll-parameter.repository";
import type { EmployeeCalculationResult, PayrollItemCalc } from "../domain/payroll.repository";

const ORDINARY_DAILY_HOURS = 8;
const DAYS_IN_PAYROLL_MONTH = 30; // convencion legal colombiana del "mes de 30 dias"
const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function bogotaHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: COMPANY_TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(date)
  );
}

/** 0 = domingo, igual que Date.getDay() pero en hora de Colombia. */
function bogotaWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: COMPANY_TIMEZONE, weekday: "short" }).format(date);
  return WEEKDAY_MAP[weekday] ?? date.getDay();
}

function toDateOnly(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Dias trabajados en el periodo bajo la convencion legal colombiana de mes de 30 dias:
 * cada mes calendario cuenta 30 dias sin importar si tiene 28/29/31, y se prorratea por
 * fecha de ingreso/retiro si caen dentro del periodo. Tope de 30 dias.
 */
export function daysWorkedInPeriod(
  periodStart: Date,
  periodEnd: Date,
  hireDate: Date,
  terminationDate: Date | null
): number {
  const effectiveStartMs = Math.max(toDateOnly(periodStart), toDateOnly(hireDate));
  const effectiveEndMs = terminationDate
    ? Math.min(toDateOnly(periodEnd), toDateOnly(terminationDate))
    : toDateOnly(periodEnd);
  if (effectiveEndMs < effectiveStartMs) return 0;
  const diffDays = Math.round((effectiveEndMs - effectiveStartMs) / 86_400_000) + 1;
  return Math.min(DAYS_IN_PAYROLL_MONTH, diffDays);
}

interface HourBuckets {
  ordinaryDayHours: number;
  ordinaryNightHours: number;
  overtimeDayHours: number;
  overtimeNightHours: number;
  sundayOrdinaryHours: number;
}

/**
 * LIMITACION CONOCIDA (documentada tambien en el README del modulo): cada `TimeEntry` se
 * clasifica como diurna/nocturna en bloque segun la hora de INICIO de la marcacion (no se
 * divide una misma marcacion que cruza la franja diurna/nocturna). Las horas que exceden
 * 8 por marcacion se tratan como extra; si un empleado tiene varias marcaciones el mismo dia,
 * no se acumulan entre si para el calculo de horas extra.
 */
function classifyTimeEntries(entries: TimeEntryRecord[]): HourBuckets {
  const buckets: HourBuckets = {
    ordinaryDayHours: 0,
    ordinaryNightHours: 0,
    overtimeDayHours: 0,
    overtimeNightHours: 0,
    sundayOrdinaryHours: 0,
  };

  for (const entry of entries) {
    if (!entry.clockOut) continue;
    const totalHours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / 3_600_000;
    if (totalHours <= 0) continue;

    const ordinaryHours = Math.min(totalHours, ORDINARY_DAILY_HOURS);
    const overtimeHours = Math.max(0, totalHours - ORDINARY_DAILY_HOURS);

    const startHour = bogotaHour(entry.clockIn);
    const isNight = startHour >= 21 || startHour < 6;
    const isSundayOrHoliday = bogotaWeekday(entry.clockIn) === 0 || isColombianHoliday(entry.clockIn);

    if (isNight) {
      buckets.ordinaryNightHours += ordinaryHours;
      buckets.overtimeNightHours += overtimeHours;
    } else {
      buckets.ordinaryDayHours += ordinaryHours;
      buckets.overtimeDayHours += overtimeHours;
    }
    if (isSundayOrHoliday) {
      buckets.sundayOrdinaryHours += ordinaryHours;
    }
  }

  return buckets;
}

export function calculateEmployeePayroll(
  employee: EmployeeRecord,
  parameter: PayrollParameterRecord,
  timeEntries: TimeEntryRecord[],
  periodStart: Date,
  periodEnd: Date,
  activeDeductions: PayrollDeductionRecord[] = []
): EmployeeCalculationResult {
  const daysWorked = daysWorkedInPeriod(periodStart, periodEnd, employee.hireDate, employee.terminationDate);
  const proration = daysWorked / DAYS_IN_PAYROLL_MONTH;
  const dailyRate = employee.baseSalary / DAYS_IN_PAYROLL_MONTH;
  const hourlyRate = employee.baseSalary / parameter.monthlyHoursDivisor;

  const items: PayrollItemCalc[] = [];

  const salaryAmount = round2(employee.baseSalary * proration);
  items.push({ conceptCode: "SALARY", quantity: daysWorked, rate: dailyRate, amount: salaryAmount });

  let transportAmount = 0;
  if (employee.baseSalary <= 2 * parameter.minimumWage) {
    transportAmount = round2(parameter.transportAllowance * proration);
    if (transportAmount > 0) {
      items.push({
        conceptCode: "TRANSPORT_ALLOWANCE",
        quantity: daysWorked,
        rate: round2(parameter.transportAllowance / DAYS_IN_PAYROLL_MONTH),
        amount: transportAmount,
      });
    }
  }

  const hours = classifyTimeEntries(timeEntries);

  let overtimeDayAmount = 0;
  if (hours.overtimeDayHours > 0) {
    overtimeDayAmount = round2(hours.overtimeDayHours * hourlyRate * (1 + parameter.overtimeDayPercent / 100));
    items.push({ conceptCode: "OVERTIME_DAY", quantity: round2(hours.overtimeDayHours), rate: hourlyRate, amount: overtimeDayAmount });
  }

  let overtimeNightAmount = 0;
  if (hours.overtimeNightHours > 0) {
    overtimeNightAmount = round2(hours.overtimeNightHours * hourlyRate * (1 + parameter.overtimeNightPercent / 100));
    items.push({ conceptCode: "OVERTIME_NIGHT", quantity: round2(hours.overtimeNightHours), rate: hourlyRate, amount: overtimeNightAmount });
  }

  let nightSurchargeAmount = 0;
  if (hours.ordinaryNightHours > 0) {
    nightSurchargeAmount = round2(hours.ordinaryNightHours * hourlyRate * (parameter.nightSurchargePercent / 100));
    items.push({ conceptCode: "NIGHT_SURCHARGE", quantity: round2(hours.ordinaryNightHours), rate: hourlyRate, amount: nightSurchargeAmount });
  }

  let sundaySurchargeAmount = 0;
  if (hours.sundayOrdinaryHours > 0) {
    sundaySurchargeAmount = round2(hours.sundayOrdinaryHours * hourlyRate * (parameter.sundayHolidaySurchargePercent / 100));
    items.push({ conceptCode: "SUNDAY_SURCHARGE", quantity: round2(hours.sundayOrdinaryHours), rate: hourlyRate, amount: sundaySurchargeAmount });
  }

  // Base salarial (constitutiva de salario): NO incluye auxilio de transporte.
  const salarialBase = salaryAmount + overtimeDayAmount + overtimeNightAmount + nightSurchargeAmount + sundaySurchargeAmount;
  const grossTotal = round2(salarialBase + transportAmount);

  const healthEmployee = round2(salarialBase * (parameter.healthEmployeePercent / 100));
  const pensionEmployee = round2(salarialBase * (parameter.pensionEmployeePercent / 100));
  items.push({ conceptCode: "HEALTH_EMPLOYEE", rate: parameter.healthEmployeePercent, amount: healthEmployee });
  items.push({ conceptCode: "PENSION_EMPLOYEE", rate: parameter.pensionEmployeePercent, amount: pensionEmployee });
  const legalDeductions = round2(healthEmployee + pensionEmployee);
  const netPayBeforeAdditionalDeductions = round2(grossTotal - legalDeductions);

  // Libranzas/embargos (PayrollDeduction, ver domain/payroll-deduction.repository.ts): se aplican
  // en orden, cada una topada por lo que quede de netPay -- NO es un calculo del limite legal de
  // embargabilidad (eso depende del tipo de acreencia y no se infiere aqui sin verificar la norma
  // vigente, ver README), es solo una salvaguarda para que netPay nunca quede negativo. El monto
  // real deducido (que puede ser menor al programado si no alcanzo netPay) es el que se resta de
  // PayrollDeduction.remainingBalance al aprobar el periodo, no el monto programado.
  let remainingNetPay = netPayBeforeAdditionalDeductions;
  const additionalDeductions: Array<{ id: string; type: string; description: string; amount: number }> = [];
  for (const deduction of activeDeductions) {
    if (remainingNetPay <= 0) break;
    const scheduled = deduction.remainingBalance !== null
      ? Math.min(deduction.amountPerPeriod, deduction.remainingBalance)
      : deduction.amountPerPeriod;
    const applied = round2(Math.min(scheduled, remainingNetPay));
    if (applied <= 0) continue;
    items.push({ conceptCode: deduction.type, amount: applied, payrollDeductionId: deduction.id });
    additionalDeductions.push({ id: deduction.id, type: deduction.type, description: deduction.description, amount: applied });
    remainingNetPay = round2(remainingNetPay - applied);
  }
  const additionalDeductionsTotal = round2(additionalDeductions.reduce((sum, d) => sum + d.amount, 0));

  const totalDeductions = round2(legalDeductions + additionalDeductionsTotal);
  const netPay = round2(grossTotal - totalDeductions);

  const arlPercent = employee.arlRiskLevel ? parameter.arlPercentByRiskLevel[employee.arlRiskLevel] ?? 0 : 0;
  const healthEmployer = round2(salarialBase * (parameter.healthEmployerPercent / 100));
  const pensionEmployer = round2(salarialBase * (parameter.pensionEmployerPercent / 100));
  const arl = round2(salarialBase * (arlPercent / 100));
  const ccf = round2(salarialBase * (parameter.familyCompensationPercent / 100));
  const icbf = round2(salarialBase * (parameter.icbfPercent / 100));
  const sena = round2(salarialBase * (parameter.senaPercent / 100));
  items.push({ conceptCode: "HEALTH_EMPLOYER", rate: parameter.healthEmployerPercent, amount: healthEmployer });
  items.push({ conceptCode: "PENSION_EMPLOYER", rate: parameter.pensionEmployerPercent, amount: pensionEmployer });
  items.push({ conceptCode: "ARL", rate: arlPercent, amount: arl });
  items.push({ conceptCode: "CCF", rate: parameter.familyCompensationPercent, amount: ccf });
  items.push({ conceptCode: "ICBF", rate: parameter.icbfPercent, amount: icbf });
  items.push({ conceptCode: "SENA", rate: parameter.senaPercent, amount: sena });

  const severance = round2(salarialBase * (parameter.severancePercent / 100));
  const severanceInterest = round2(severance * (parameter.severanceInterestPercent / 100) * (daysWorked / 360));
  const serviceBonus = round2(salarialBase * (parameter.serviceBonusPercent / 100));
  const vacation = round2(salarialBase * (parameter.vacationPercent / 100));
  items.push({ conceptCode: "SEVERANCE", rate: parameter.severancePercent, amount: severance });
  items.push({ conceptCode: "SEVERANCE_INTEREST", rate: parameter.severanceInterestPercent, amount: severanceInterest });
  items.push({ conceptCode: "SERVICE_BONUS", rate: parameter.serviceBonusPercent, amount: serviceBonus });
  items.push({ conceptCode: "VACATION", rate: parameter.vacationPercent, amount: vacation });

  const employerContributions = healthEmployer + pensionEmployer + arl + ccf + icbf + sena;
  const provisions = severance + severanceInterest + serviceBonus + vacation;
  const employerCostTotal = round2(grossTotal + employerContributions + provisions);

  return {
    employeeId: employee.id,
    grossTotal,
    totalDeductions,
    netPay,
    employerCostTotal,
    items,
    summary: {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      period: { startDate: periodStart.toISOString(), endDate: periodEnd.toISOString() },
      daysWorked,
      devengados: {
        salary: salaryAmount,
        transportAllowance: transportAmount,
        overtimeDay: overtimeDayAmount,
        overtimeNight: overtimeNightAmount,
        nightSurcharge: nightSurchargeAmount,
        sundaySurcharge: sundaySurchargeAmount,
        total: grossTotal,
      },
      deducciones: {
        health: healthEmployee,
        pension: pensionEmployee,
        adicionales: additionalDeductions,
        total: totalDeductions,
      },
      netPay,
      aportesPatronales: { health: healthEmployer, pension: pensionEmployer, arl, ccf, icbf, sena },
      provisiones: { severance, severanceInterest, serviceBonus, vacation },
      employerCostTotal,
      generatedAt: new Date().toISOString(),
    },
  };
}
