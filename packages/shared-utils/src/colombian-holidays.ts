/**
 * Festivos colombianos (Ley 51 de 1983, "Ley Emiliani"): calculados algoritmicamente para no
 * requerir mantenimiento manual año a año. 18 festivos por año:
 * - 6 fijos: Año Nuevo, Trabajo, Independencia, Batalla de Boyaca, Inmaculada Concepcion, Navidad.
 * - 7 civiles trasladados al lunes siguiente si no caen en lunes: Reyes Magos, San Jose, San
 *   Pedro y San Pablo, Asuncion, Dia de la Raza, Todos los Santos, Independencia de Cartagena.
 * - 5 religiosos calculados desde el Domingo de Pascua: Jueves Santo y Viernes Santo (no se
 *   trasladan), y Ascension/Corpus Christi/Sagrado Corazon (se trasladan al lunes siguiente).
 */

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/** Traslada al lunes siguiente (o deja igual si ya cae en lunes), regla de la Ley Emiliani. */
function nextMonday(date: Date): Date {
  const daysToAdd = (8 - date.getUTCDay()) % 7;
  return addUtcDays(date, daysToAdd);
}

/** Domingo de Pascua para un año dado (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monthIndex = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0 = enero
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, monthIndex, day);
}

function utcDateKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

const holidaysCache = new Map<number, Set<string>>();

/** Los 18 festivos colombianos de un año, como fecha calendario (medianoche UTC). */
export function getColombianHolidays(year: number): Date[] {
  const easter = computeEasterSunday(year);

  const fixed = [
    utcDate(year, 0, 1), // Año Nuevo
    utcDate(year, 4, 1), // Dia del Trabajo
    utcDate(year, 6, 20), // Dia de la Independencia
    utcDate(year, 7, 7), // Batalla de Boyaca
    utcDate(year, 11, 8), // Inmaculada Concepcion
    utcDate(year, 11, 25), // Navidad
  ];

  const civilEmiliani = [
    utcDate(year, 0, 6), // Reyes Magos
    utcDate(year, 2, 19), // San Jose
    utcDate(year, 5, 29), // San Pedro y San Pablo
    utcDate(year, 7, 15), // Asuncion de la Virgen
    utcDate(year, 9, 12), // Dia de la Raza
    utcDate(year, 10, 1), // Todos los Santos
    utcDate(year, 10, 11), // Independencia de Cartagena
  ].map(nextMonday);

  const religious = [
    addUtcDays(easter, -3), // Jueves Santo
    addUtcDays(easter, -2), // Viernes Santo
    nextMonday(addUtcDays(easter, 39)), // Ascension del Señor
    nextMonday(addUtcDays(easter, 60)), // Corpus Christi
    nextMonday(addUtcDays(easter, 68)), // Sagrado Corazon
  ];

  return [...fixed, ...civilEmiliani, ...religious];
}

function getHolidayKeysForYear(year: number): Set<string> {
  let cached = holidaysCache.get(year);
  if (!cached) {
    cached = new Set(getColombianHolidays(year).map(utcDateKey));
    holidaysCache.set(year, cached);
  }
  return cached;
}

/**
 * true si `date` cae en un festivo colombiano. La comparacion es por fecha calendario en la
 * zona horaria de Colombia (America/Bogota), no por el instante UTC.
 */
export function isColombianHoliday(date: Date): boolean {
  const bogotaKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const year = Number(bogotaKey.slice(0, 4));
  return getHolidayKeysForYear(year).has(bogotaKey);
}
