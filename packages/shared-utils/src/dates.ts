export const COMPANY_TIMEZONE = "America/Bogota";

export function nowInBogota(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: COMPANY_TIMEZONE }));
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
