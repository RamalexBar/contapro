export const COMPANY_TIMEZONE = "America/Bogota";

export function nowInBogota(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: COMPANY_TIMEZONE }));
}

/** Colombia no tiene horario de verano: siempre UTC-5. */
const BOGOTA_OFFSET = "-05:00";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fecha de un filtro de informe ("2026-10-12", lo que manda un <input type="date">) como el
 * inicio de ese dia en Colombia. Sin esto `new Date("2026-10-12")` es la medianoche UTC, que en
 * Colombia todavia es el dia anterior a las 7 p. m. Otro formato se interpreta tal cual.
 */
export function startOfDayInBogota(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000${BOGOTA_OFFSET}`) : new Date(value);
}

/**
 * Igual, pero el final de ese dia: un informe "hasta el 12 de octubre" incluye lo de ese dia.
 * Antes `to`/`asOf` se tomaban como la medianoche UTC y los movimientos del mismo dia quedaban
 * por fuera (un informe hasta hoy no mostraba las ventas de hoy).
 */
export function endOfDayInBogota(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999${BOGOTA_OFFSET}`) : new Date(value);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Regla de negocio: el periodo de gracia son exactamente 2 dias despues del vencimiento.
 */
export function calculateGraceEndsAt(currentPeriodEnd: Date): Date {
  return addDays(currentPeriodEnd, 2);
}

/**
 * Regla de negocio: si el pago llega dentro del periodo de gracia, el nuevo vencimiento se
 * calcula desde la fecha de vencimiento ORIGINAL (nunca desde la fecha de pago), para que el
 * cliente nunca gane dias por pagar tarde.
 *
 * Ejemplo: vence 31 de agosto, paga 2 de septiembre (dentro de los 2 dias de gracia) ->
 * nuevo vencimiento = 30 de septiembre (un mes desde el 31 de agosto original).
 */
export function calculateNextPeriodEnd(originalPeriodEnd: Date, cycleMonths: 1 | 12): Date {
  const result = new Date(originalPeriodEnd);
  result.setMonth(result.getMonth() + (cycleMonths === 1 ? 1 : 12));
  return result;
}
