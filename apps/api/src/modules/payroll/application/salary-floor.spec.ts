import { describe, expect, it } from "vitest";
import { assertLegalSalaries } from "./salary-floor";

const SMMLV = 1_750_905;
const emp = (baseSalary: number, extra: Partial<{ salaryType: string; contractType: string; weeklyHours: number | null }> = {}) => ({
  firstName: "Laura",
  lastName: "Gomez",
  baseSalary,
  salaryType: extra.salaryType ?? "ORDINARY",
  contractType: extra.contractType ?? "INDEFINITE",
  weeklyHours: extra.weeklyHours ?? null,
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

  it("part-time: the floor is proportional to the agreed hours over the 42-hour legal week", () => {
    // 21 h/semana = media jornada: minimo $875.453 (redondeado)
    expect(() => assertLegalSalaries([emp(875_453, { weeklyHours: 21 })], SMMLV, 42)).not.toThrow();
    expect(() => assertLegalSalaries([emp(800_000, { weeklyHours: 21 })], SMMLV, 42)).toThrow("minimo $875.453 por 21 h/semana");
  });

  it("agreed hours equal to (or above) the legal week count as full time", () => {
    expect(() => assertLegalSalaries([emp(1_400_000, { weeklyHours: 42 })], SMMLV, 42)).toThrow("minimo $1.750.905)");
  });
});
