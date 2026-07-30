import { describe, expect, it } from "vitest";
import { computeNextInvoiceNumber } from "./numbering-claim";

const baseResolution = {
  resolutionNumber: "18760000001",
  prefix: "SETP",
  rangeFrom: 990000001,
  rangeTo: 990001000,
  currentNumber: 0,
};

describe("computeNextInvoiceNumber", () => {
  it("uses rangeFrom as the first number when currentNumber is 0", () => {
    const result = computeNextInvoiceNumber(baseResolution);
    expect(result.number).toBe(990000001);
    expect(result.fullNumber).toBe("SETP990000001");
  });

  it("increments currentNumber by one on subsequent claims", () => {
    const result = computeNextInvoiceNumber({ ...baseResolution, currentNumber: 990000001 });
    expect(result.number).toBe(990000002);
    expect(result.fullNumber).toBe("SETP990000002");
  });

  it("throws once the range is exhausted", () => {
    expect(() => computeNextInvoiceNumber({ ...baseResolution, currentNumber: 990001000 })).toThrow(
      /agoto su rango autorizado/
    );
  });
});
