import { describe, expect, it } from "vitest";
import { generateCufe } from "./cufe-generator";

const baseInput = {
  fullNumber: "SETP990000001",
  issueDate: new Date("2026-07-29T15:30:00.000Z"),
  subtotal: 100000,
  ivaAmount: 19000,
  consumptionTaxAmount: 0,
  icaAmount: 0,
  total: 119000,
  issuerNit: "900123456",
  buyerDocumentNumber: "222222222222",
  technicalKey: "",
  environment: "HABILITACION" as const,
};

describe("generateCufe", () => {
  it("returns a 96-character hex SHA-384 digest", () => {
    const cufe = generateCufe(baseInput);
    expect(cufe).toMatch(/^[0-9a-f]{96}$/);
  });

  it("is deterministic for the same input", () => {
    expect(generateCufe(baseInput)).toBe(generateCufe(baseInput));
  });

  it("changes when the invoice number changes", () => {
    const cufe = generateCufe(baseInput);
    const other = generateCufe({ ...baseInput, fullNumber: "SETP990000002" });
    expect(cufe).not.toBe(other);
  });

  it("changes when the environment changes", () => {
    const cufe = generateCufe(baseInput);
    const other = generateCufe({ ...baseInput, environment: "PRODUCCION" });
    expect(cufe).not.toBe(other);
  });

  it("still generates a value when technicalKey is empty (pre-habilitacion default)", () => {
    expect(() => generateCufe(baseInput)).not.toThrow();
  });
});
