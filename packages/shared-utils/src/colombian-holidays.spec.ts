import { describe, expect, it } from "vitest";
import { computeEasterSunday, getColombianHolidays, isColombianHoliday } from "./colombian-holidays";

const YEARS_SAMPLE = [2000, 2010, 2020, 2023, 2024, 2025, 2026, 2027, 2030, 2050, 2100];

describe("computeEasterSunday", () => {
  // Fechas de Pascua publicas y bien conocidas (calendario gregoriano), no un valor que este
  // codigo se auto-confirme -- son la referencia externa real para validar el algoritmo de
  // Meeus/Jones/Butcher.
  const KNOWN_EASTER_DATES: Record<number, [month: number, day: number]> = {
    2000: [3, 23],
    2023: [3, 9],
    2024: [2, 31],
    2025: [3, 20],
    2026: [3, 5],
    2027: [2, 28],
  };

  it("matches well-known Easter Sunday dates", () => {
    for (const [year, [month, day]] of Object.entries(KNOWN_EASTER_DATES)) {
      const easter = computeEasterSunday(Number(year));
      expect([easter.getUTCMonth(), easter.getUTCDate()], `Easter ${year}`).toEqual([month, day]);
    }
  });

  it("always falls on a Sunday, by definition", () => {
    for (const year of YEARS_SAMPLE) {
      expect(computeEasterSunday(year).getUTCDay(), `year ${year}`).toBe(0);
    }
  });

  it("always falls between March 22 and April 25 (the valid Gregorian Easter range)", () => {
    for (const year of YEARS_SAMPLE) {
      const easter = computeEasterSunday(year);
      const dayOfYear = Math.round((easter.getTime() - Date.UTC(year, 0, 1)) / 86_400_000);
      const march22 = Math.round((Date.UTC(year, 2, 22) - Date.UTC(year, 0, 1)) / 86_400_000);
      const april25 = Math.round((Date.UTC(year, 3, 25) - Date.UTC(year, 0, 1)) / 86_400_000);
      expect(dayOfYear, `year ${year}`).toBeGreaterThanOrEqual(march22);
      expect(dayOfYear, `year ${year}`).toBeLessThanOrEqual(april25);
    }
  });
});

describe("getColombianHolidays", () => {
  it("returns exactly 18 holidays per year", () => {
    for (const year of YEARS_SAMPLE) {
      expect(getColombianHolidays(year), `year ${year}`).toHaveLength(18);
    }
  });

  it("keeps the 6 fixed holidays on their calendar date every year", () => {
    const FIXED: Array<[month: number, day: number]> = [
      [0, 1], // Año Nuevo
      [4, 1], // Trabajo
      [6, 20], // Independencia
      [7, 7], // Batalla de Boyaca
      [11, 8], // Inmaculada Concepcion
      [11, 25], // Navidad
    ];
    for (const year of YEARS_SAMPLE) {
      const keys = new Set(getColombianHolidays(year).map((d) => `${d.getUTCMonth()}-${d.getUTCDate()}`));
      for (const [month, day] of FIXED) {
        expect(keys.has(`${month}-${day}`), `year ${year}, ${month}-${day}`).toBe(true);
      }
    }
  });

  it("moves the 7 civil (Ley Emiliani) holidays to the following Monday when they don't already fall on one", () => {
    // Fechas base civiles trasladables (antes del corrimiento). Se usa el Date nativo como
    // oraculo de que dia de la semana cae cada fecha base -- no se asume ningun año/dia
    // concretos de memoria, asi que el test es valido para cualquier año de la muestra.
    const BASE_DATES: Array<[month: number, day: number]> = [
      [0, 6], // Reyes Magos
      [2, 19], // San Jose
      [5, 29], // San Pedro y San Pablo
      [7, 15], // Asuncion
      [9, 12], // Dia de la Raza
      [10, 1], // Todos los Santos
      [10, 11], // Independencia de Cartagena
    ];

    for (const year of YEARS_SAMPLE) {
      const holidayKeys = new Set(getColombianHolidays(year).map((d) => `${d.getUTCMonth()}-${d.getUTCDate()}`));

      for (const [month, day] of BASE_DATES) {
        const base = new Date(Date.UTC(year, month, day));
        const isAlreadyMonday = base.getUTCDay() === 1;

        if (isAlreadyMonday) {
          expect(holidayKeys.has(`${month}-${day}`), `year ${year}, ${month}-${day} (already Monday)`).toBe(true);
        } else {
          const daysToAdd = (8 - base.getUTCDay()) % 7;
          const shifted = new Date(Date.UTC(year, month, day + daysToAdd));
          expect(shifted.getUTCDay(), `year ${year}, shifted ${month}-${day}`).toBe(1);
          expect(
            holidayKeys.has(`${shifted.getUTCMonth()}-${shifted.getUTCDate()}`),
            `year ${year}, ${month}-${day} shifted to Monday`
          ).toBe(true);
        }
      }
    }
  });

  it("puts Jueves Santo and Viernes Santo on the Thursday/Friday before Easter, unmoved", () => {
    for (const year of YEARS_SAMPLE) {
      const easter = computeEasterSunday(year);
      const holidays = getColombianHolidays(year);

      const juevesSanto = new Date(easter.getTime() - 3 * 86_400_000);
      const viernesSanto = new Date(easter.getTime() - 2 * 86_400_000);
      expect(juevesSanto.getUTCDay(), `year ${year} Jueves Santo`).toBe(4);
      expect(viernesSanto.getUTCDay(), `year ${year} Viernes Santo`).toBe(5);

      const keys = new Set(holidays.map((d) => `${d.getUTCMonth()}-${d.getUTCDate()}`));
      expect(keys.has(`${juevesSanto.getUTCMonth()}-${juevesSanto.getUTCDate()}`), `year ${year}`).toBe(true);
      expect(keys.has(`${viernesSanto.getUTCMonth()}-${viernesSanto.getUTCDate()}`), `year ${year}`).toBe(true);
    }
  });

  it("moves Ascension/Corpus Christi/Sagrado Corazon (Easter +39/+60/+68) to the following Monday", () => {
    for (const year of YEARS_SAMPLE) {
      const easter = computeEasterSunday(year);
      const holidays = getColombianHolidays(year);
      const keys = new Set(holidays.map((d) => `${d.getUTCMonth()}-${d.getUTCDate()}`));

      for (const offset of [39, 60, 68]) {
        const base = new Date(easter.getTime() + offset * 86_400_000);
        const daysToAdd = (8 - base.getUTCDay()) % 7;
        const shifted = new Date(base.getTime() + daysToAdd * 86_400_000);
        expect(shifted.getUTCDay(), `year ${year}, +${offset}`).toBe(1);
        expect(keys.has(`${shifted.getUTCMonth()}-${shifted.getUTCDate()}`), `year ${year}, +${offset}`).toBe(true);
      }
    }
  });
});

describe("isColombianHoliday", () => {
  it("returns true for a fixed holiday at Bogota midday", () => {
    // 15:00 UTC = 10:00 Bogota (UTC-5), bien dentro del 25 de diciembre en ambas zonas.
    expect(isColombianHoliday(new Date("2026-12-25T15:00:00.000Z"))).toBe(true);
  });

  it("returns false for an ordinary weekday", () => {
    // 11 de febrero de 2026 no es festivo fijo, civil trasladado ni religioso ese año.
    expect(isColombianHoliday(new Date("2026-02-11T15:00:00.000Z"))).toBe(false);
  });

  it("uses the Bogota calendar date, not the UTC calendar date, near a day boundary", () => {
    // 2026-12-26T02:00:00Z es todavia 2026-12-25 21:00 en Bogota (UTC-5): sigue siendo Navidad
    // en Bogota aunque la fecha UTC ya cambio.
    expect(isColombianHoliday(new Date("2026-12-26T02:00:00.000Z"))).toBe(true);
    // Mismo instante desplazado 5 horas mas: ya es 2026-12-26 02:00 en Bogota, dia normal.
    expect(isColombianHoliday(new Date("2026-12-26T07:00:00.000Z"))).toBe(false);
  });
});
