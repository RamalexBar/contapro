import { describe, expect, it } from "vitest";
import { payrollIncludesMonthCommissions } from "./payroll-commission.reader";

describe("payrollIncludesMonthCommissions", () => {
  it("monthly payroll always includes the month commissions", () => {
    expect(payrollIncludesMonthCommissions({ periodType: "MONTHLY", endDate: new Date("2026-10-31") })).toBe(true);
  });

  it("biweekly: only the second fortnight (the one ending on the last day of the month)", () => {
    expect(payrollIncludesMonthCommissions({ periodType: "BIWEEKLY", endDate: new Date("2026-10-15") })).toBe(false);
    expect(payrollIncludesMonthCommissions({ periodType: "BIWEEKLY", endDate: new Date("2026-10-31") })).toBe(true);
    expect(payrollIncludesMonthCommissions({ periodType: "BIWEEKLY", endDate: new Date("2026-02-28") })).toBe(true);
  });
});
