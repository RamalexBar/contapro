/**
 * Calcula la proxima fecha de ejecucion de una plantilla de facturacion recurrente mensual
 * (item 36 de docs/ALCANCE.md), dado un dia fijo del mes (1-28, sin casos borde de fin de mes).
 *
 * Dos usos con semantica distinta, controlados por `mode`:
 * - "seed" (al crear la plantilla): el dia de hoy SI cuenta -- si `dayOfMonth` cae hoy o mas
 *   adelante este mes, la primera ejecucion es este mes.
 * - "advance" (tras una ejecucion exitosa): el `dayOfMonth` de ESTE ciclo ya se uso, por lo que
 *   la proxima ejecucion nunca puede caer el mismo dia -- siempre avanza al menos un mes, mismo
 *   criterio que `calculateNextPeriodEnd` en saas-admin calcula siempre desde el periodo
 *   ANTERIOR, nunca desde "hoy".
 */
export function calculateNextRunDate(dayOfMonth: number, from: Date, mode: "seed" | "advance"): Date {
  const fromDateOnly = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const candidate = new Date(from.getFullYear(), from.getMonth(), dayOfMonth);

  const mustAdvance = mode === "seed" ? candidate < fromDateOnly : candidate <= fromDateOnly;
  if (mustAdvance) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}
