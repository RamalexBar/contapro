import { describe, expect, it } from "vitest";
import { assertLegalSalaries } from "./salary-floor";

const SMMLV = 1_750_905;
const emp = (baseSalary: number, extra: Partial<{ salaryType: string; contractType: string }> = {}) => ({
  firstName: "Laura",
  lastName: "Gomez",
  baseSalary,
  salaryType: extra.salaryType ?? "ORDINARY",
  contractType: extra.contractType ?? "INDEFINITE",
});

describe("assertLegalSalaries", () => {
  it("rejects an ordinary salary below the minimum wage, naming the employee", () => {
    expect(() => assertLegalSalaries([emp(1_400_000)], SMMLV)).toThrow(/menor al salario minimo.*Laura Gomez/);
  });

  it("accepts exactly the minimum wage and obra o labor contracts at or above it", () => {
    expect(() => assertLegalSalaries([emp(SMMLV), emp(2_000_000, { contractType: "SERVICE" })], SMMLV)).not.toThrow();
  });

  it("does not apply the floor to SENA apprentices (apoyo de sostenimiento)", () => {
    expect(() => assertLegalSalaries([emp(1_313_179, { contractType: "LEARNING" })], SMMLV)).not.toThrow();
  });

  it("keeps the 13 SMMLV floor for integral salaries", () => {
    expect(() => assertLegalSalaries([emp(12 * SMMLV, { salaryType: "INTEGRAL" })], SMMLV)).toThrow(/13 salarios minimos/);
    expect(() => assertLegalSalaries([emp(13 * SMMLV, { salaryType: "INTEGRAL" })], SMMLV)).not.toThrow();
  });
});
