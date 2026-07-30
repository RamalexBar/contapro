import { describe, expect, it } from "vitest";
import { generateCude } from "./cude-generator";

const baseInput = {
  fullNumber: "NC1",
  issueDate: new Date("2026-07-29T15:30:00.000Z"),
  amount: 26180,
  taxAmount: 4180,
  issuerNit: "900123456",
  buyerDocumentNumber: "222222222222",
  technicalKey: "",
  environment: "HABILITACION" as const,
  noteTypeCode: "91",
  referenceCufe: "e41803b1bf317335ee7c3582ddef3b2af077a40b19ff377a84f11b967cf4a50e382193e1502a52017f8e6009cf8f0e94",
};

describe("generateCude", () => {
  it("returns a 96-character hex SHA-384 digest", () => {
    expect(generateCude(baseInput)).toMatch(/^[0-9a-f]{96}$/);
  });

  it("is deterministic for the same input", () => {
    expect(generateCude(baseInput)).toBe(generateCude(baseInput));
  });

  it("changes when the note number changes", () => {
    const cude = generateCude(baseInput);
    const other = generateCude({ ...baseInput, fullNumber: "NC2" });
    expect(cude).not.toBe(other);
  });

  it("changes when the referenced invoice CUFE changes", () => {
    const cude = generateCude(baseInput);
    const other = generateCude({ ...baseInput, referenceCufe: "0".repeat(96) });
    expect(cude).not.toBe(other);
  });

  it("changes with the note type code (credit vs debit)", () => {
    const cude = generateCude(baseInput);
    const other = generateCude({ ...baseInput, noteTypeCode: "92" });
    expect(cude).not.toBe(other);
  });

  it("still generates a value when technicalKey is empty (pre-habilitacion default)", () => {
    expect(() => generateCude(baseInput)).not.toThrow();
  });
});
