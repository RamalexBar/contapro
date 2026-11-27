import { isColombianHoliday, round2 } from "@erp/shared-utils";
import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { TimeEntryRecord } from "../../timetracking/domain/timetracking.repository";
import type { PayrollDeductionRecord } from "../domain/payroll-deduction.repository";
import type { PayrollParameterRecord } from "../domain/payroll-parameter.repository";
import type { EmployeeCalculationResult, PayrollItemCalc } from "../domain/payroll.repository";
import { computeNovelties, type PayrollNovelty } from "./payroll-novelties";

const ORDINARY_DAILY_HOURS = 8;
const DAYS_IN_PAYROLL_MONTH = 30; // convencion legal colombiana del "mes de 30 dias"

const DAY_MS = 86_400_000;

function isLastDayOfFebruary(date: Date): boolean {
  return date.getUTCMonth() === 1 && new Date(date.getTime() + DAY_MS).getUTCMonth() === 2;
}

/**
 * Dias entre dos fechas (ambas incluidas) en año comercial de 360 dias / meses de 30, como se
 * liquidan nomina y prestaciones en Colombia: el 31 cuenta como 30 y el ultimo dia de febrero como 30.
 * Asi un mes siempre vale 30 dias (tambien febrero) y cada quincena 15 (1-15 y 16-fin de mes, sea
 * 28, 29, 30 o 31).
 */
export function days360(start: Date, end: Date): number {
  if (end.getTime() < start.getTime()) return 0;
  const d1 = Math.min(start.getUTCDate(), 30);
  const d2 = isLastDayOfFebruary(end) ? 30 : Math.min(end.getUTCDate(), 30);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 360 + (end.getUTCMonth() - start.getUTCMonth()) * 30 + (d2 - d1) + 1;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Dias trabajados en el periodo con la convencion del mes comercial de 30 dias (ver days360),
 * proporcional a la fecha de ingreso/retiro si caen dentro del periodo. Tope de 30 dias.
 */
export function daysWorkedInPeriod(
  periodStart: Date,
  periodEnd: Date,
  hireDate: Date,
  terminationDate: Date | null
): number {
  const start = toDateOnly(periodStart.getTime() >= hireDate.getTime() ? periodStart : hireDate);
  const endCandidate = terminationDate && terminationDate.getTime() < periodEnd.getTime() ? terminationDate : periodEnd;
  const end = toDateOnly(endCandidate);
  return Math.min(DAYS_IN_PAYROLL_MONTH, days360(start, end));
}

interface HourBuckets {
  ordinaryDayHours: number;
  ordinaryNightHours: number;
  overtimeDayHours: number;
  overtimeNightHours: number;
  sundayOrdinaryHours: number;
  /** Suma de horas x porcentaje de recargo dominical de cada marcacion (el % cambia por fecha). */
  sundayPercentHours: number;
}

// ---- Calendario legal (verificado 2026-11-23) ----
// Ley 2466 de 2025 (reforma laboral, promulgada 2025-06-25): el trabajo nocturno empieza a las
// 7 p. m. desde el 2025-12-25 (antes: 9 p. m.).
const NIGHT_FROM_7PM_SINCE = Date.UTC(2025, 11, 25, 5); // 2025-12-25 00:00 hora Colombia
// Ley 2466 de 2025: recargo dominical/festivo escalonado. Se aplica el MAYOR entre este minimo
// legal y el del parametro del año (el parametro puede ser mas generoso, nunca menor).
const SUNDAY_SURCHARGE_SCHEDULE: Array<{ since: number; percent: number }> = [
  { since: Date.UTC(2027, 6, 1, 5), percent: 100 },
  { since: Date.UTC(2026, 6, 1, 5), percent: 90 },
  { since: Date.UTC(2025, 6, 1, 5), percent: 80 },
];
// Ley 2101 de 2021: reduccion gradual de la jornada maxima semanal. Divisor mensual de horas =
// horas semanales / 6 dias x 30 (48h -> 240, 44h -> 220, 42h -> 210). Se usa el MENOR entre este y
// el del parametro (un divisor menor da una hora mas cara, nunca se paga por debajo de la ley).
const WEEKLY_HOURS_SCHEDULE: Array<{ since: number; divisor: number }> = [
  { since: Date.UTC(2026, 6, 15, 5), divisor: 210 },
  { since: Date.UTC(2025, 6, 15, 5), divisor: 220 },
  { since: Date.UTC(2024, 6, 15, 5), divisor: 230 },
  { since: Date.UTC(2023, 6, 15, 5), divisor: 235 },
];

export function legalSundaySurchargePercent(date: Date, parameterPercent: number): number {
  const legal = SUNDAY_SURCHARGE_SCHEDULE.find((s) => date.getTime() >= s.since)?.percent ?? 0;
  return Math.max(parameterPercent, legal);
}

export function legalMonthlyHoursDivisor(date: Date, parameterDivisor: number): number {
  const legal = WEEKLY_HOURS_SCHEDULE.find((s) => date.getTime() >= s.since)?.divisor ?? parameterDivisor;
  return Math.min(parameterDivisor, legal);
}

// Colombia no tiene horario de verano: hora local = UTC-5 fija. Se usa aritmetica directa porque
// la clasificacion recorre las marcaciones minuto a minuto.
const BOGOTA_OFFSET_MS = 5 * 3_600_000;
const MINUTE_MS = 60_000;

/**
 * Clasifica las horas trabajadas minuto a minuto:
 * - diurna/nocturna segun la hora real de cada minuto (una marcacion de 5 p. m. a 11 p. m. se divide
 *   en horas diurnas y nocturnas; el nocturno empieza a las 7 p. m. desde el 2025-12-25, Ley 2466);
 * - las primeras 8 horas de cada DIA (sumando todas las marcaciones de ese dia en hora Colombia) son
 *   ordinarias y las demas son extra;
 * - el recargo dominical/festivo se aplica a toda hora trabajada en domingo o festivo, ordinaria o
 *   extra (la hora extra dominical lleva su recargo de extra MAS el dominical), con el % vigente en
 *   esa fecha.
 * LIMITACION: el limite de 8 horas diarias es la jornada estandar; si la empresa pacto otra
 * distribucion de la jornada semanal (ej. 42 h en 5 dias), las horas por encima de 8 en un dia se
 * siguen tratando como extra.
 */
function classifyTimeEntries(entries: TimeEntryRecord[], parameterSundayPercent: number): HourBuckets {
  const buckets: HourBuckets = {
    ordinaryDayHours: 0,
    ordinaryNightHours: 0,
    overtimeDayHours: 0,
    overtimeNightHours: 0,
    sundayOrdinaryHours: 0,
    sundayPercentHours: 0,
  };
  const minutesByDay = new Map<number, number>();
  const holidayCache = new Map<number, boolean>();
  const ordinaryMinutesPerDay = ORDINARY_DAILY_HOURS * 60;

  const sorted = entries.filter((e) => e.clockOut && e.clockOut > e.clockIn).sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());
  for (const entry of sorted) {
    for (let t = entry.clockIn.getTime(); t < entry.clockOut!.getTime(); t += MINUTE_MS) {
      const local = new Date(t - BOGOTA_OFFSET_MS);
      const dayKey = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
      const worked = minutesByDay.get(dayKey) ?? 0;
      minutesByDay.set(dayKey, worked + 1);
      const isOvertime = worked >= ordinaryMinutesPerDay;

      const hour = local.getUTCHours();
      const nightStartHour = t >= NIGHT_FROM_7PM_SINCE ? 19 : 21;
      const isNight = hour >= nightStartHour || hour < 6;
      const hours = 1 / 60;
      if (isOvertime) {
        if (isNight) buckets.overtimeNightHours += hours;
        else buckets.overtimeDayHours += hours;
      } else if (isNight) buckets.ordinaryNightHours += hours;
      else buckets.ordinaryDayHours += hours;

      let isHoliday = holidayCache.get(dayKey);
      if (isHoliday === undefined) {
        isHoliday = isColombianHoliday(new Date(t));
        holidayCache.set(dayKey, isHoliday);
      }
      if (local.getUTCDay() === 0 || isHoliday) {
        buckets.sundayOrdinaryHours += hours;
        buckets.sundayPercentHours += hours * legalSundaySurchargePercent(new Date(t), parameterSundayPercent);
      }
    }
  }
  for (const key of Object.keys(buckets) as Array<keyof HourBuckets>) buckets[key] = round2(buckets[key]);
  return buckets;
}


/** Opciones de la empresa que cambian la liquidacion (no dependen del empleado ni del año). */
export interface PayrollCompanyOptions {
  /**
   * Exoneracion de aportes del art. 114-1 del Estatuto Tributario: salud del empleador (8,5%),
   * SENA (2%) e ICBF (3%) NO se pagan por los trabajadores que devenguen menos de 10 SMMLV.
   * Aplica a sociedades y personas juridicas declarantes de renta, a personas naturales con 2 o mas
   * trabajadores y a contribuyentes del regimen SIMPLE. NO aplica, entre otros, a entidades sin
   * animo de lucro ni a personas naturales con un solo trabajador. Lo marca la empresa (su
   * contador), porque depende de su situacion tributaria, no de un dato que Contapro pueda inferir.
   */
  exemptArt1141: boolean;
}

const DEFAULT_COMPANY_OPTIONS: PayrollCompanyOptions = { exemptArt1141: false };

/**
 * Fondo de Solidaridad Pensional (art. 27 Ley 100 de 1993, modificado por art. 8 Ley 797 de 2003):
 * aporte adicional del trabajador cuando su IBC es de 4 SMMLV o mas.
 */
export function solidarityFundPercent(ibcInMinimumWages: number): number {
  if (ibcInMinimumWages < 4) return 0;
  if (ibcInMinimumWages < 16) return 1;
  if (ibcInMinimumWages < 17) return 1.2;
  if (ibcInMinimumWages < 18) return 1.4;
  if (ibcInMinimumWages < 19) return 1.6;
  if (ibcInMinimumWages < 20) return 1.8;
  return 2;
}

/** Tabla del art. 383 del E.T. (retencion en la fuente por ingresos laborales), en UVT. */
const WITHHOLDING_TABLE: Array<{ from: number; rate: number; plusUvt: number }> = [
  { from: 2300, rate: 39, plusUvt: 770 },
  { from: 945, rate: 37, plusUvt: 268 },
  { from: 640, rate: 35, plusUvt: 162 },
  { from: 360, rate: 33, plusUvt: 69 },
  { from: 150, rate: 28, plusUvt: 10 },
  { from: 95, rate: 19, plusUvt: 0 },
];

// Renta exenta del 25% (num. 10 art. 206 E.T., Ley 2277 de 2022): tope 790 UVT al año.
const EXEMPT_25_ANNUAL_CAP_UVT = 790;
// Tope conjunto de deducciones + rentas exentas (art. 336 E.T.): 40% y 1.340 UVT al año.
const EXEMPTIONS_ANNUAL_CAP_UVT = 1340;

/** Soportes que el trabajador certifico para la retencion (valores MENSUALES). */
export interface WithholdingSupports {
  /** Dependientes economicos (art. 387 E.T.): deduce el 10% del ingreso laboral, tope 32 UVT/mes. */
  dependents: boolean;
  /** Intereses de credito de vivienda (art. 119 E.T.): tope 100 UVT/mes. */
  housingInterest: number;
  /** Medicina prepagada / seguros de salud (art. 387 E.T.): tope 16 UVT/mes. */
  prepaidHealth: number;
  /** Aportes voluntarios a pension, AFC o AVC (arts. 126-1 y 126-4): renta exenta hasta el 30% del
   * ingreso laboral y 3.800 UVT/año. */
  voluntaryPension: number;
}

const NO_SUPPORTS: WithholdingSupports = { dependents: false, housingInterest: 0, prepaidHealth: 0, voluntaryPension: 0 };

/**
 * Retencion en la fuente por salarios, procedimiento 1 (art. 385 E.T.), mensual:
 *   ingresos laborales del mes
 *   - ingresos no constitutivos de renta (aportes obligatorios a salud, pension y FSP del trabajador)
 *   - deducciones (dependientes, intereses de vivienda, medicina prepagada) con sus topes
 *   - rentas exentas: aportes voluntarios/AFC (30% y 3.800 UVT/año) y el 25% (tope 790 UVT/año)
 *   con el tope conjunto de deducciones + exentas: 40% y 1.340 UVT/año (art. 336 E.T.)
 *   = base gravable, que se lleva a UVT y se busca en la tabla del art. 383.
 * El resultado se redondea al multiplo de 1.000 mas cercano (art. 868 E.T.).
 *
 * LIMITACION: no aplica la deduccion adicional de 72 UVT por dependiente de la Ley 2277 de 2022
 * (art. 336 num. 3) ni el procedimiento 2; el contador puede ajustar con una deduccion manual.
 */
export function salaryWithholdingTax(
  laborIncome: number,
  nonTaxableContributions: number,
  uvt: number,
  supports: WithholdingSupports = NO_SUPPORTS
): number {
  if (uvt <= 0) return 0;
  const netIncome = Math.max(0, laborIncome - nonTaxableContributions);
  const deductions =
    (supports.dependents ? Math.min(laborIncome * 0.1, 32 * uvt) : 0) +
    Math.min(Math.max(0, supports.housingInterest), 100 * uvt) +
    Math.min(Math.max(0, supports.prepaidHealth), 16 * uvt);
  const voluntaryExempt = Math.min(Math.max(0, supports.voluntaryPension), laborIncome * 0.3, (3800 / 12) * uvt);
  const exempt25 = Math.min(
    Math.max(0, netIncome - deductions - voluntaryExempt) * 0.25,
    (EXEMPT_25_ANNUAL_CAP_UVT / 12) * uvt
  );
  const exemptions = Math.min(deductions + voluntaryExempt + exempt25, netIncome * 0.4, (EXEMPTIONS_ANNUAL_CAP_UVT / 12) * uvt);
  const baseUvt = (netIncome - exemptions) / uvt;
  const row = WITHHOLDING_TABLE.find((r) => baseUvt > r.from);
  if (!row) return 0;
  const taxUvt = (baseUvt - row.from) * (row.rate / 100) + row.plusUvt;
  return Math.round((taxUvt * uvt) / 1000) * 1000;
}

export function calculateEmployeePayroll(
  employee: EmployeeRecord,
  parameter: PayrollParameterRecord,
  timeEntries: TimeEntryRecord[],
  periodStart: Date,
  periodEnd: Date,
  activeDeductions: PayrollDeductionRecord[] = [],
  companyOptions: PayrollCompanyOptions = DEFAULT_COMPANY_OPTIONS,
  novelties: PayrollNovelty[] = []
): EmployeeCalculationResult {
  const daysWorked = daysWorkedInPeriod(periodStart, periodEnd, employee.hireDate, employee.terminationDate);
  const proration = daysWorked / DAYS_IN_PAYROLL_MONTH;
  const dailyRate = employee.baseSalary / DAYS_IN_PAYROLL_MONTH;
  const hoursDivisor = legalMonthlyHoursDivisor(periodEnd, parameter.monthlyHoursDivisor);
  // Tiempo parcial: el valor de la hora sale de las horas pactadas (mismas 5 "semanas" por mes que el
  // divisor legal: 42 h x 5 = 210), no de la jornada completa.
  const partTimeHours = employee.weeklyHours != null && employee.weeklyHours * 5 < hoursDivisor ? employee.weeklyHours * 5 : null;
  const hourlyRate = employee.baseSalary / (partTimeHours ?? hoursDivisor);

  const items: PayrollItemCalc[] = [];

  // Novedades (incapacidades, licencias, vacaciones, dias no remunerados), solo dentro del tiempo
  // en que el trabajador estuvo vinculado en el periodo. Ver payroll-novelties.ts.
  const employedFrom = employee.hireDate.getTime() > periodStart.getTime() ? employee.hireDate : periodStart;
  const employedTo = employee.terminationDate && employee.terminationDate.getTime() < periodEnd.getTime() ? employee.terminationDate : periodEnd;
  const nov = computeNovelties({ novelties, from: employedFrom, to: employedTo, baseSalary: employee.baseSalary, minimumWage: parameter.minimumWage });
  const noveltyDays = Math.min(daysWorked, nov.totalNoveltyDays);
  // Dias efectivamente trabajados: llevan auxilio de transporte y cotizan ARL.
  const workedDays = round2(daysWorked - noveltyDays);
  // Salario ordinario: dias trabajados + domingos/festivos dentro de las vacaciones.
  const salaryDays = round2(Math.min(daysWorked, workedDays + nov.vacationRestDays));
  // Dias remunerados (todo menos licencias no remuneradas/ausencias): base del IBC minimo y de prestaciones.
  const paidDays = round2(Math.max(0, daysWorked - nov.unpaidDays));

  const salaryAmount = round2(dailyRate * salaryDays);
  items.push({ conceptCode: "SALARY", quantity: salaryDays, rate: dailyRate, amount: salaryAmount });

  const noveltyItems: Array<{ code: string; days: number; amount: number }> = [
    { code: "VACATION_PAY", days: nov.vacationBusinessDays, amount: nov.vacationAmount },
    { code: "SICK_LEAVE_EMPLOYER", days: nov.sickGeneralEmployerDays, amount: nov.sickGeneralEmployerAmount },
    { code: "SICK_LEAVE_EPS", days: nov.sickGeneralEpsDays, amount: nov.sickGeneralEpsAmount },
    { code: "WORK_INJURY_ARL", days: nov.sickLaborArlDays, amount: nov.sickLaborArlAmount },
    { code: "MATERNITY_LEAVE", days: nov.maternityDays, amount: nov.maternityAmount },
    { code: "PATERNITY_LEAVE", days: nov.paternityDays, amount: nov.paternityAmount },
  ];
  for (const n of noveltyItems) {
    if (n.amount > 0) items.push({ conceptCode: n.code, quantity: n.days, rate: round2(n.amount / n.days), amount: n.amount });
  }
  if (nov.unpaidDays > 0) items.push({ conceptCode: "UNPAID_LEAVE", quantity: nov.unpaidDays, rate: 0, amount: 0 });
  const vacationPay = nov.vacationAmount;
  // Incapacidades y licencias: no son salario (no van a parafiscales) y son rentas exentas (art. 206
  // num. 1 y 2 E.T.), pero si cotizan salud y pension.
  const leavePay = round2(
    nov.sickGeneralEmployerAmount + nov.sickGeneralEpsAmount + nov.sickLaborArlAmount + nov.maternityAmount + nov.paternityAmount
  );

  // Salario integral (art. 132 CST): incluye el factor prestacional (30%), asi que no lleva auxilio
  // de transporte, ni cesantias, intereses ni prima; los aportes se liquidan sobre el 70%.
  const isIntegral = employee.salaryType === "INTEGRAL";

  let transportAmount = 0;
  if (!isIntegral && employee.baseSalary <= 2 * parameter.minimumWage) {
    // Solo por los dias trabajados: en vacaciones, incapacidades y licencias no hay desplazamiento.
    transportAmount = round2((parameter.transportAllowance / DAYS_IN_PAYROLL_MONTH) * workedDays);
    if (transportAmount > 0) {
      items.push({
        conceptCode: "TRANSPORT_ALLOWANCE",
        quantity: workedDays,
        rate: round2(parameter.transportAllowance / DAYS_IN_PAYROLL_MONTH),
        amount: transportAmount,
      });
    }
  }

  const hours = classifyTimeEntries(timeEntries, parameter.sundayHolidaySurchargePercent);

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
    sundaySurchargeAmount = round2(hourlyRate * (hours.sundayPercentHours / 100));
    items.push({
      conceptCode: "SUNDAY_SURCHARGE",
      quantity: round2(hours.sundayOrdinaryHours),
      rate: round2(hours.sundayPercentHours / hours.sundayOrdinaryHours),
      amount: sundaySurchargeAmount,
    });
  }

  const variablePay = round2(overtimeDayAmount + overtimeNightAmount + nightSurchargeAmount + sundaySurchargeAmount);
  // Base salarial (constitutiva de salario): NO incluye auxilio de transporte. Las vacaciones si.
  const salarialBase = round2(salaryAmount + variablePay + vacationPay);
  const grossTotal = round2(salarialBase + leavePay + transportAmount);

  // IBC para salud, pension y FSP: lo devengado (incluidas incapacidades y licencias), minimo 1 SMMLV
  // y maximo 25 SMMLV, proporcional a los dias remunerados (art. 18 Ley 100 de 1993, art. 5 Ley 797
  // de 2003). Los dias de licencia no remunerada no cotizan salud.
  const minimumWageForDays = parameter.minimumWage * (paidDays / DAYS_IN_PAYROLL_MONTH);
  const ibcSource = round2(salarialBase + leavePay);
  const contributionBase = isIntegral ? round2(salarialBase * 0.7) : salarialBase;
  const ibcBase = isIntegral ? round2(ibcSource * 0.7) : ibcSource;
  const ibc = paidDays > 0 ? round2(Math.min(Math.max(ibcBase, minimumWageForDays), 25 * minimumWageForDays)) : 0;
  const ibcInMinimumWages = minimumWageForDays > 0 ? ibc / minimumWageForDays : 0;
  const earningsInMinimumWages = parameter.minimumWage * proration > 0 ? salarialBase / (parameter.minimumWage * proration) : 0;
  // ARL: solo por los dias trabajados (en vacaciones, incapacidad o licencia no hay riesgo que cubrir).
  const minimumWageForWorkedDays = parameter.minimumWage * (workedDays / DAYS_IN_PAYROLL_MONTH);
  const arlSource = round2(dailyRate * workedDays + variablePay);
  const arlBase = workedDays > 0 ? round2(Math.min(Math.max(isIntegral ? arlSource * 0.7 : arlSource, minimumWageForWorkedDays), 25 * minimumWageForWorkedDays)) : 0;

  const healthEmployee = round2(ibc * (parameter.healthEmployeePercent / 100));
  const pensionEmployee = round2(ibc * (parameter.pensionEmployeePercent / 100));
  items.push({ conceptCode: "HEALTH_EMPLOYEE", rate: parameter.healthEmployeePercent, amount: healthEmployee });
  items.push({ conceptCode: "PENSION_EMPLOYEE", rate: parameter.pensionEmployeePercent, amount: pensionEmployee });

  const solidarityPercent = solidarityFundPercent(ibcInMinimumWages);
  const solidarityFund = round2(ibc * (solidarityPercent / 100));
  if (solidarityFund > 0) {
    items.push({ conceptCode: "SOLIDARITY_FUND", rate: solidarityPercent, amount: solidarityFund });
  }

  // La tabla del art. 383 es MENSUAL: en una quincena se calcula sobre el equivalente mensual del pago
  // y se toma la parte del periodo (la mitad), para no quedar en un rango mas bajo que el real.
  const periodFactor = Math.min(1, days360(toDateOnly(periodStart), toDateOnly(periodEnd)) / DAYS_IN_PAYROLL_MONTH);
  const supports = {
    dependents: employee.withholdingDependents,
    housingInterest: employee.withholdingHousingInterest,
    prepaidHealth: employee.withholdingPrepaidHealth,
    voluntaryPension: employee.withholdingVoluntaryPension,
  };
  const contributions = healthEmployee + pensionEmployee + solidarityFund;
  // Incapacidades y licencias de maternidad/paternidad son rentas exentas (art. 206 num. 1 y 2 E.T.).
  const taxableLaborIncome = round2(grossTotal - leavePay);
  const withholdingTax =
    periodFactor < 1 && periodFactor > 0
      ? Math.round((salaryWithholdingTax(taxableLaborIncome / periodFactor, contributions / periodFactor, parameter.uvt, supports) * periodFactor) / 1000) * 1000
      : salaryWithholdingTax(taxableLaborIncome, contributions, parameter.uvt, supports);
  if (withholdingTax > 0) {
    items.push({ conceptCode: "WITHHOLDING_TAX", amount: withholdingTax });
  }

  const legalDeductions = round2(healthEmployee + pensionEmployee + solidarityFund + withholdingTax);
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

  // Exoneracion art. 114-1 E.T.: por trabajador que devengue menos de 10 SMMLV.
  const exempt = companyOptions.exemptArt1141 && earningsInMinimumWages < 10;

  const arlPercent = employee.arlRiskLevel ? parameter.arlPercentByRiskLevel[employee.arlRiskLevel] ?? 0 : 0;
  const healthEmployer = exempt ? 0 : round2(ibc * (parameter.healthEmployerPercent / 100));
  // Licencia no remunerada: el empleador sigue cotizando su parte de pension (12 %) sobre el salario de
  // esos dias; salud, ARL y parafiscales no (Decreto 1406 de 1999, novedad SLN de la PILA). Verificar con
  // el contador: hay quien tambien liquida la parte del trabajador.
  const unpaidPensionBase = round2(dailyRate * nov.unpaidDays);
  const pensionEmployer = round2((ibc + unpaidPensionBase) * (parameter.pensionEmployerPercent / 100));
  const arl = round2(arlBase * (arlPercent / 100));
  // Parafiscales (caja, ICBF, SENA) sobre la nomina de salarios del mes, sin el tope de 25 SMMLV
  // (en salario integral, sobre el 70%).
  const ccf = round2(contributionBase * (parameter.familyCompensationPercent / 100));
  const icbf = exempt ? 0 : round2(contributionBase * (parameter.icbfPercent / 100));
  const sena = exempt ? 0 : round2(contributionBase * (parameter.senaPercent / 100));
  if (healthEmployer > 0) items.push({ conceptCode: "HEALTH_EMPLOYER", rate: parameter.healthEmployerPercent, amount: healthEmployer });
  items.push({ conceptCode: "PENSION_EMPLOYER", rate: parameter.pensionEmployerPercent, amount: pensionEmployer });
  items.push({ conceptCode: "ARL", rate: arlPercent, amount: arl });
  items.push({ conceptCode: "CCF", rate: parameter.familyCompensationPercent, amount: ccf });
  if (icbf > 0) items.push({ conceptCode: "ICBF", rate: parameter.icbfPercent, amount: icbf });
  if (sena > 0) items.push({ conceptCode: "SENA", rate: parameter.senaPercent, amount: sena });

  // Cesantias y prima se liquidan sobre el salario MAS el auxilio de transporte (art. 7 Ley 1 de 1963:
  // el auxilio se incorpora al salario para liquidar prestaciones sociales). Vacaciones no: son
  // descanso remunerado y se pagan solo con el salario ordinario.
  // Los dias de incapacidad, licencia remunerada y vacaciones cuentan para prestaciones con el salario
  // completo; los de licencia no remunerada no (suspenden el contrato, art. 53 CST).
  const benefitsSalary = round2(dailyRate * paidDays + variablePay);
  const benefitsBase = round2(benefitsSalary + transportAmount);
  const severance = isIntegral ? 0 : round2(benefitsBase * (parameter.severancePercent / 100));
  // Intereses de cesantias: 12% anual sobre las cesantias (Ley 52 de 1975). La provision del mes es
  // el 12% de las cesantias causadas en el mes (los dias ya estan en `severance` via la proporcion),
  // asi al cierre del año la provision acumulada = 12% de las cesantias del año.
  const severanceInterest = round2(severance * (parameter.severanceInterestPercent / 100));
  const serviceBonus = isIntegral ? 0 : round2(benefitsBase * (parameter.serviceBonusPercent / 100));
  const vacation = round2(benefitsSalary * (parameter.vacationPercent / 100));
  if (!isIntegral) {
    items.push({ conceptCode: "SEVERANCE", rate: parameter.severancePercent, amount: severance });
    items.push({ conceptCode: "SEVERANCE_INTEREST", rate: parameter.severanceInterestPercent, amount: severanceInterest });
    items.push({ conceptCode: "SERVICE_BONUS", rate: parameter.serviceBonusPercent, amount: serviceBonus });
  }
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
      workedDays,
      ibc,
      salaryType: isIntegral ? "INTEGRAL" : "ORDINARY",
      exemptArt1141: exempt,
      devengados: {
        salary: salaryAmount,
        transportAllowance: transportAmount,
        overtimeDay: overtimeDayAmount,
        overtimeNight: overtimeNightAmount,
        nightSurcharge: nightSurchargeAmount,
        sundaySurcharge: sundaySurchargeAmount,
        vacationPay,
        sickLeaveEmployer: nov.sickGeneralEmployerAmount,
        sickLeaveEps: nov.sickGeneralEpsAmount,
        workInjuryArl: nov.sickLaborArlAmount,
        maternityLeave: nov.maternityAmount,
        paternityLeave: nov.paternityAmount,
        total: grossTotal,
      },
      novedades: {
        vacationBusinessDays: nov.vacationBusinessDays,
        vacationRestDays: nov.vacationRestDays,
        sickLeaveDays: round2(nov.sickGeneralEmployerDays + nov.sickGeneralEpsDays),
        workInjuryDays: nov.sickLaborArlDays,
        maternityDays: nov.maternityDays,
        paternityDays: nov.paternityDays,
        unpaidDays: nov.unpaidDays,
      },
      /** Lo que el empleador recobra a la EPS/ARL (incapacidades desde el dia 3, ARL, licencias). */
      recoverableFromSocialSecurity: round2(nov.sickGeneralEpsAmount + nov.sickLaborArlAmount + nov.maternityAmount + nov.paternityAmount),
      deducciones: {
        health: healthEmployee,
        pension: pensionEmployee,
        solidarityFund,
        withholdingTax,
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
