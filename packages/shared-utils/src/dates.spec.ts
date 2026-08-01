import { describe, expect, it } from "vitest";
import { addDays, calculateGraceEndsAt, calculateNextPeriodEnd, nowInBogota } from "./dates";

// Los asserts comparan por componentes de fecha LOCAL (getFullYear/getMonth/getDate), no por
// toISOString(): tanto addDays como calculateNextPeriodEnd operan con setDate()/setMonth(), que
// son en hora LOCAL de la maquina que corre el test, no UTC. Comparar por ISO string introduciria
// ruido de zona horaria si el runner no esta en UTC-5.
function ymd(date: Date): [number, number, number] {
  return [date.getFullYear(), date.getMonth(), date.getDate()];
}

describe("addDays", () => {
  it("adds days within the same month", () => {
    expect(ymd(addDays(new Date(2026, 0, 10), 5))).toEqual([2026, 0, 15]);
  });

  it("rolls over into the next month", () => {
    expect(ymd(addDays(new Date(2026, 0, 31), 1))).toEqual([2026, 1, 1]);
  });

  it("rolls over into the next year", () => {
    expect(ymd(addDays(new Date(2026, 11, 30), 5))).toEqual([2027, 0, 4]);
  });

  it("does not mutate the input date", () => {
    const original = new Date(2026, 0, 10);
    addDays(original, 5);
    expect(ymd(original)).toEqual([2026, 0, 10]);
  });
});

describe("calculateGraceEndsAt", () => {
  it("is exactly 2 days after the period end", () => {
    expect(ymd(calculateGraceEndsAt(new Date(2026, 7, 31)))).toEqual([2026, 8, 2]);
  });
});

describe("calculateNextPeriodEnd", () => {
  it("adds 1 month for a monthly cycle", () => {
    expect(ymd(calculateNextPeriodEnd(new Date(2026, 2, 15), 1))).toEqual([2026, 3, 15]);
  });

  it("adds 12 months for a yearly cycle", () => {
    expect(ymd(calculateNextPeriodEnd(new Date(2026, 2, 15), 12))).toEqual([2027, 2, 15]);
  });

  it("KNOWN QUIRK: overflows into the following month when the anchor day doesn't exist in the target month (JS Date.setMonth behavior, not corrected here)", () => {
    // Jan 31 + 1 month should "morally" be Feb 28 (or the last day of Feb), but setMonth() just
    // adds 1 to the month index and keeps day=31, which overflows past Feb's 28 days into March.
    // Documented as a characterization test, not a claim that this is the desired behavior --
    // subscriptions anchored on the 29th/30th/31st will drift forward a few days whenever the
    // next billing month is shorter. Worth knowing about if this ever causes a real billing
    // complaint; fixing it is a separate decision (clamp to the last day of the target month).
    const result = calculateNextPeriodEnd(new Date(2026, 0, 31), 1);
    expect(ymd(result)).toEqual([2026, 2, 3]); // "March 3", not "Feb 28"
  });
});

describe("nowInBogota", () => {
  // nowInBogota() reinterpreta la hora de Bogota como si fuera la hora LOCAL de la maquina que
  // corre el proceso (patron comun para "fingir" una zona horaria fija con el Date nativo) -- su
  // valor absoluto (getTime()) solo coincide con Date.now() cuando la maquina YA esta en
  // UTC-5/America-Bogota, que es el caso de este sandbox pero no algo garantizado en otro runner
  // (CI en UTC, otra maquina, etc). Por eso el test no compara closeness contra Date.now(): eso
  // seria una prueba que pasa aqui por coincidencia y podria fallar en otro entorno.
  it("returns a valid, non-NaN Date", () => {
    const result = nowInBogota();
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it("does not go backwards across two consecutive calls", () => {
    const first = nowInBogota();
    const second = nowInBogota();
    expect(second.getTime()).toBeGreaterThanOrEqual(first.getTime());
  });
});
