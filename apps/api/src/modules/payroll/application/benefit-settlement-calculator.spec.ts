import { describe, expect, it } from "vitest";
import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { PayrollParameterRecord } from "../domain/payroll-parameter.repository";
import {
  days360,
  indemnityLine,
  serviceBonusLine,
  severanceExemptPercent,
  severanceLines,
  vacationLine,
} from "./benefit-settlement-calculator";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const PARAM = {
  minimumWage: 1_750_905,
  transportAllowance: 249_095,
  uvt: 52_374,
} as PayrollParameterRecord;

function employee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: "e1",
    firstName: "Laura",
    lastName: "Gomez",
    documentNumber: "1",
    baseSalary: 1_750_905,
    hireDate: d("2025-01-10"),
    terminationDate: null,
    contractType: "INDEFINITE",
    salaryType: "ORDINARY",
    ...overrides,
  } as EmployeeRecord;
}

const NO_DATA = { variableEarnings: 0, provisions: {} };

describe("benefit settlement calculator", () => {
  it("days360: commercial 30-day months, both ends included", () => {
    expect(days360(d("2026-01-01"), d("2026-06-30"))).toBe(180);
    expect(days360(d("2026-07-01"), d("2026-12-31"))).toBe(180);
    expect(days360(d("2026-02-01"), d("2026-02-28"))).toBe(30);
    expect(days360(d("2025-01-10"), d("2026-11-15"))).toBe(666);
  });

  it("prima de servicios: salary + transport allowance x days / 360", () => {
    const full = serviceBonusLine(employee(), PARAM, d("2026-01-01"), d("2026-06-30"), NO_DATA);
    expect(full?.base).toBe(2_000_000);
    expect(full?.amount).toBe(1_000_000);

    // Ingreso el 16 de marzo: 105 dias del semestre.
    const partial = serviceBonusLine(employee({ hireDate: d("2026-03-16") }), PARAM, d("2026-01-01"), d("2026-06-30"), NO_DATA);
    expect(partial?.days).toBe(105);
    expect(partial?.amount).toBe(583_333.33);
  });

  it("includes the monthly average of overtime and surcharges in the base", () => {
    const line = serviceBonusLine(employee(), PARAM, d("2026-01-01"), d("2026-06-30"), { variableEarnings: 600_000, provisions: {} });
    expect(line?.base).toBe(2_100_000);
  });

  it("cesantias and 12% interest for a full year; carries what was provisioned", () => {
    const [severance, interest] = severanceLines(employee(), PARAM, d("2026-01-01"), d("2026-12-31"), {
      variableEarnings: 0,
      provisions: { SEVERANCE: 1_900_000, SEVERANCE_INTEREST: 228_000 },
    });
    expect(severance.amount).toBe(2_000_000);
    expect(interest.amount).toBe(240_000);
    expect(severance.provisioned).toBe(1_900_000);
  });

  it("salario integral has no prima or cesantias", () => {
    const integral = employee({ salaryType: "INTEGRAL", baseSalary: 25_000_000 });
    expect(serviceBonusLine(integral, PARAM, d("2026-01-01"), d("2026-06-30"), NO_DATA)).toBeNull();
    expect(severanceLines(integral, PARAM, d("2026-01-01"), d("2026-12-31"), NO_DATA)).toEqual([]);
  });

  it("pending vacation: 15 days per year minus days taken, paid on ordinary salary", () => {
    const line = vacationLine(employee(), d("2026-11-15"), 15, 500_000);
    // 666 dias -> 27.75 causados - 15 tomados = 12.75 dias x 1,750,905 / 30
    expect(line?.days).toBe(12.75);
    expect(line?.amount).toBe(744_134.63);
  });

  it("indemnity art. 64 CST: indefinite contract under 10 SMMLV = 30 days + 20 per extra year", () => {
    const line = indemnityLine(employee(), PARAM, d("2026-11-15"), "WITHOUT_JUST_CAUSE", null);
    // 1.85 anos -> 30 + 20 x 0.85 = 47 dias
    expect(line?.days).toBe(47);
    expect(line?.amount).toBe(2_743_084.5);
    expect(indemnityLine(employee(), PARAM, d("2026-11-15"), "RESIGNATION", null)).toBeNull();
  });

  it("indemnity for a fixed-term contract: the salaries until the agreed end date", () => {
    const line = indemnityLine(employee({ contractType: "FIXED_TERM" }), PARAM, d("2026-11-15"), "WITHOUT_JUST_CAUSE", d("2027-02-15"));
    expect(line?.days).toBe(90);
  });

  it("exempt part of cesantias by average salary (art. 206 num. 4 E.T.)", () => {
    expect(severanceExemptPercent(350)).toBe(100);
    expect(severanceExemptPercent(400)).toBe(90);
    expect(severanceExemptPercent(700)).toBe(0);
  });
});
