import { describe, expect, it } from "vitest";
import { calculateNextRunDate } from "./calculate-next-run-date";

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("calculateNextRunDate", () => {
  describe("mode=seed (al crear la plantilla)", () => {
    it("keeps this month when the day has not happened yet", () => {
      const result = calculateNextRunDate(20, d(2026, 8, 15), "seed");
      expect(result).toEqual(d(2026, 8, 20));
    });

    it("keeps this month when the day is today (hoy cuenta)", () => {
      const result = calculateNextRunDate(15, d(2026, 8, 15), "seed");
      expect(result).toEqual(d(2026, 8, 15));
    });

    it("rolls over to next month when the day already passed this month", () => {
      const result = calculateNextRunDate(10, d(2026, 8, 15), "seed");
      expect(result).toEqual(d(2026, 9, 10));
    });
  });

  describe("mode=advance (tras una ejecucion exitosa)", () => {
    it("always advances at least one month, even if the day matches exactly", () => {
      const result = calculateNextRunDate(6, d(2026, 8, 6), "advance");
      expect(result).toEqual(d(2026, 9, 6));
    });

    it("rolls over the year boundary correctly", () => {
      const result = calculateNextRunDate(15, d(2026, 12, 15), "advance");
      expect(result).toEqual(d(2027, 1, 15));
    });
  });
});
