import { isColombianHoliday, round2 } from "@erp/shared-utils";

/**
 * Novedades de nomina que salen de Horarios/Vacaciones (ya aprobadas) y cambian lo que se paga:
 *
 * | Novedad | Quien paga | Valor por dia | Norma |
 * |---|---|---|---|
 * | Incapacidad de origen comun | Dias 1-2 el empleador, desde el 3 la EPS | 2/3 del salario hasta el dia 90, 1/2 del 91 en adelante, nunca menos del salario minimo diario | Art. 227 CST, Decreto 2943/2013, Sentencia C-543/2007 |
 * | Incapacidad laboral (ARL) | Dia del accidente el empleador (como salario), desde el siguiente la ARL | 100 % del salario | Ley 776/2002 art. 3 |
 * | Licencia de maternidad | EPS | 100 % del salario (18 semanas) | Ley 1822/2017 |
 * | Licencia de paternidad | EPS | 100 % del salario (2 semanas) | Ley 2114/2021 |
 * | Vacaciones disfrutadas | Empleador, contra la provision | Salario de cada dia habil; domingos y festivos siguen siendo salario | Art. 186 CST |
 * | Licencia no remunerada / ausencia injustificada | Nadie | 0: suspende el contrato y esos dias no cuentan para prestaciones | Arts. 51 y 53 CST |
 *
 * El empleador le paga todo al trabajador en la nomina y despues recobra a la EPS o la ARL lo que les
 * corresponde (cuenta por cobrar, ver post-payroll-journal-entry.use-case.ts).
 */
export type PayrollNoveltyKind = "SICK_GENERAL" | "SICK_LABOR" | "MATERNITY" | "PATERNITY" | "VACATION" | "UNPAID_LEAVE";

export interface PayrollNovelty {
  kind: PayrollNoveltyKind;
  /** Primer y ultimo dia (incluidos) de toda la novedad, aunque empiece o termine fuera del periodo. */
  startDate: Date;
  endDate: Date;
}

/** Si dos novedades caen el mismo dia, gana la de mayor prioridad (orden de esta lista). */
const PRIORITY: PayrollNoveltyKind[] = ["MATERNITY", "PATERNITY", "SICK_LABOR", "SICK_GENERAL", "VACATION", "UNPAID_LEAVE"];

const DAY_MS = 86_400_000;

/** isColombianHoliday mira la fecha en hora de Bogota: se le pasa el mediodia del dia. */
function isRestDay(date: Date): boolean {
  return date.getUTCDay() === 0 || isColombianHoliday(new Date(date.getTime() + 12 * 3_600_000));
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Peso de un dia calendario en el mes comercial de 30 dias (ver days360): el 31 no cuenta y el
 * ultimo dia de febrero cuenta por los dias que le faltan para llegar a 30.
 */
function commercialWeight(date: Date): number {
  const day = date.getUTCDate();
  if (day === 31) return 0;
  const isLastOfFebruary = date.getUTCMonth() === 1 && new Date(date.getTime() + DAY_MS).getUTCMonth() === 2;
  return isLastOfFebruary ? 30 - day + 1 : 1;
}

export interface NoveltyBreakdown {
  /** Dias de incapacidad comun que paga el empleador (1 y 2) y que paga la EPS (3 en adelante), con su valor. */
  sickGeneralEmployerDays: number;
  sickGeneralEmployerAmount: number;
  sickGeneralEpsDays: number;
  sickGeneralEpsAmount: number;
  /** Incapacidad laboral desde el dia siguiente al accidente (la paga la ARL). */
  sickLaborArlDays: number;
  sickLaborArlAmount: number;
  maternityDays: number;
  maternityAmount: number;
  paternityDays: number;
  paternityAmount: number;
  /** Dias habiles de vacaciones (se pagan contra la provision). */
  vacationBusinessDays: number;
  vacationAmount: number;
  /** Domingos y festivos dentro de las vacaciones: se pagan como salario, sin auxilio de transporte. */
  vacationRestDays: number;
  unpaidDays: number;
  /** Dias que el trabajador no estuvo trabajando (todas las novedades): no llevan auxilio de transporte ni ARL. */
  totalNoveltyDays: number;
}

const EMPTY: NoveltyBreakdown = {
  sickGeneralEmployerDays: 0,
  sickGeneralEmployerAmount: 0,
  sickGeneralEpsDays: 0,
  sickGeneralEpsAmount: 0,
  sickLaborArlDays: 0,
  sickLaborArlAmount: 0,
  maternityDays: 0,
  maternityAmount: 0,
  paternityDays: 0,
  paternityAmount: 0,
  vacationBusinessDays: 0,
  vacationAmount: 0,
  vacationRestDays: 0,
  unpaidDays: 0,
  totalNoveltyDays: 0,
};

/** Dias 1-2 de la incapacidad comun los paga el empleador. */
const EMPLOYER_SICK_DAYS = 2;

/**
 * Reparte los dias del periodo (desde `from` hasta `to`, ya recortados a la fecha de ingreso/retiro)
 * entre las novedades. `baseSalary` y `minimumWage` son mensuales.
 */
export function computeNovelties(params: {
  novelties: PayrollNovelty[];
  from: Date;
  to: Date;
  baseSalary: number;
  minimumWage: number;
}): NoveltyBreakdown {
  if (params.novelties.length === 0) return { ...EMPTY };
  const dailyRate = params.baseSalary / 30;
  const minimumDaily = params.minimumWage / 30;
  const from = dateOnly(params.from);
  const to = dateOnly(params.to);

  const claimed = new Map<number, PayrollNovelty>();
  const sorted = [...params.novelties].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  for (const novelty of sorted) {
    const start = Math.max(dateOnly(novelty.startDate).getTime(), from.getTime());
    const end = Math.min(dateOnly(novelty.endDate).getTime(), to.getTime());
    for (let t = start; t <= end; t += DAY_MS) {
      if (!claimed.has(t)) claimed.set(t, novelty);
    }
  }

  const out = { ...EMPTY };
  for (const [t, novelty] of claimed) {
    const date = new Date(t);
    const weight = commercialWeight(date);
    if (weight === 0) continue;
    // Dia numero k de la novedad, contado desde su inicio real (puede venir del periodo anterior).
    const k = Math.round((t - dateOnly(novelty.startDate).getTime()) / DAY_MS) + 1;

    switch (novelty.kind) {
      case "SICK_GENERAL": {
        const value = Math.max(dailyRate * (k <= 90 ? 2 / 3 : 0.5), minimumDaily) * weight;
        if (k <= EMPLOYER_SICK_DAYS) {
          out.sickGeneralEmployerDays += weight;
          out.sickGeneralEmployerAmount += value;
        } else {
          out.sickGeneralEpsDays += weight;
          out.sickGeneralEpsAmount += value;
        }
        out.totalNoveltyDays += weight;
        break;
      }
      case "SICK_LABOR":
        // El dia del accidente se paga como salario (lo trabajo, al menos en parte).
        if (k === 1) break;
        out.sickLaborArlDays += weight;
        out.sickLaborArlAmount += dailyRate * weight;
        out.totalNoveltyDays += weight;
        break;
      case "MATERNITY":
        out.maternityDays += weight;
        out.maternityAmount += dailyRate * weight;
        out.totalNoveltyDays += weight;
        break;
      case "PATERNITY":
        out.paternityDays += weight;
        out.paternityAmount += dailyRate * weight;
        out.totalNoveltyDays += weight;
        break;
      case "VACATION":
        if (isRestDay(date)) {
          out.vacationRestDays += weight;
        } else {
          out.vacationBusinessDays += weight;
          out.vacationAmount += dailyRate * weight;
        }
        out.totalNoveltyDays += weight;
        break;
      case "UNPAID_LEAVE":
        out.unpaidDays += weight;
        out.totalNoveltyDays += weight;
        break;
    }
  }

  for (const key of Object.keys(out) as Array<keyof NoveltyBreakdown>) out[key] = round2(out[key]);
  return out;
}

/**
 * Dias habiles de vacaciones entre dos fechas (lunes a sabado, sin festivos): las vacaciones son
 * 15 dias habiles por año (art. 186 CST) y el sabado es habil salvo que la jornada se reparta de
 * lunes a viernes, cosa que la empresa ajusta a mano.
 */
export function vacationBusinessDaysBetween(start: Date, end: Date): number {
  let days = 0;
  for (let t = dateOnly(start).getTime(); t <= dateOnly(end).getTime(); t += DAY_MS) {
    const date = new Date(t);
    if (!isRestDay(date)) days++;
  }
  return days;
}
