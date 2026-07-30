import { describe, expect, it } from "vitest";
import { generateCuds } from "./cuds-generator";

const baseInput = {
  fullNumber: "DS1",
  issueDate: new Date("2026-07-30T15:30:00.000Z"),
  subtotal: 100000,
  taxAmount: 19000,
  total: 119000,
  issuerNit: "900123456",
  supplierDocumentNumber: "1010101010",
  technicalKey: "",
  environment: "HABILITACION" as const,
};

describe("generateCuds", () => {
  it("returns a 96-character hex SHA-384 digest", () => {
    expect(generateCuds(baseInput)).toMatch(/^[0-9a-f]{96}$/);
  });

  it("is deterministic for the same input", () => {
    expect(generateCuds(baseInput)).toBe(generateCuds(baseInput));
  });

  it("changes when the document number changes", () => {
    const cuds = generateCuds(baseInput);
    const other = generateCuds({ ...baseInput, fullNumber: "DS2" });
    expect(cuds).not.toBe(other);
  });

  it("changes when the supplier document number changes", () => {
    const cuds = generateCuds(baseInput);
    const other = generateCuds({ ...baseInput, supplierDocumentNumber: "9999999999" });
    expect(cuds).not.toBe(other);
  });

  it("still generates a value when technicalKey is empty (pre-habilitacion default)", () => {
    expect(() => generateCuds(baseInput)).not.toThrow();
  });
});
