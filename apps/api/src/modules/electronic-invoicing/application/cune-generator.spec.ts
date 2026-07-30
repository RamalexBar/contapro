import { describe, expect, it } from "vitest";
import { generateCune } from "./cune-generator";

const baseInput = {
  fullNumber: "NE1",
  periodStart: new Date("2026-07-01T00:00:00.000Z"),
  periodEnd: new Date("2026-07-31T00:00:00.000Z"),
  issueDate: new Date("2026-08-01T15:30:00.000Z"),
  grossTotal: 1500000,
  totalDeductions: 150000,
  netPay: 1350000,
  issuerNit: "900123456",
  employeeDocumentNumber: "1010101010",
  technicalKey: "",
  environment: "HABILITACION" as const,
};

describe("generateCune", () => {
  it("returns a 96-character hex SHA-384 digest", () => {
    expect(generateCune(baseInput)).toMatch(/^[0-9a-f]{96}$/);
  });

  it("is deterministic for the same input", () => {
    expect(generateCune(baseInput)).toBe(generateCune(baseInput));
  });

  it("changes when the document number changes", () => {
    const cune = generateCune(baseInput);
    const other = generateCune({ ...baseInput, fullNumber: "NE2" });
    expect(cune).not.toBe(other);
  });

  it("changes when the employee document number changes", () => {
    const cune = generateCune(baseInput);
    const other = generateCune({ ...baseInput, employeeDocumentNumber: "9999999999" });
    expect(cune).not.toBe(other);
  });

  it("changes when net pay changes", () => {
    const cune = generateCune(baseInput);
    const other = generateCune({ ...baseInput, netPay: 999999 });
    expect(cune).not.toBe(other);
  });

  it("still generates a value when technicalKey is empty (pre-habilitacion default)", () => {
    expect(() => generateCune(baseInput)).not.toThrow();
  });
});
