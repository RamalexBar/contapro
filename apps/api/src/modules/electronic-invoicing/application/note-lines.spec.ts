import { describe, expect, it } from "vitest";
import { noteLinesFromAmount } from "./note-lines";
import { splitProviderNumber } from "./numbering-claim";

const lineTotal = (l: { quantity: number; unitPrice: number; taxPercent: number }) =>
  Math.round(l.quantity * l.unitPrice * (1 + l.taxPercent / 100) * 100) / 100;

describe("noteLinesFromAmount", () => {
  it("separates the IVA of a discount on a sale with a single rate", () => {
    const lines = noteLinesFromAmount({
      amount: 11_900,
      description: "Rebaja por defecto",
      saleLines: [{ taxPercent: 19, total: 119_000 }],
      taxable: true,
    });
    expect(lines).toEqual([{ code: "NOTA-1", description: "Rebaja por defecto", quantity: 1, unitPrice: 10_000, taxPercent: 19 }]);
  });

  it("splits the amount between rates in proportion to the sale and the parts add up exactly", () => {
    const lines = noteLinesFromAmount({
      amount: 10_000,
      description: "Descuento",
      saleLines: [
        { taxPercent: 19, total: 119_000 },
        { taxPercent: 5, total: 21_000 },
        { taxPercent: 0, total: 60_000 },
      ],
      taxable: true,
    });
    expect(lines.map((l) => l.taxPercent)).toEqual([19, 5, 0]);
    // 119.000 / 200.000 = 59,5 % -> 5.950 con IVA -> base 5.000
    expect(lines[0]).toEqual(expect.objectContaining({ unitPrice: 5_000, description: "Descuento (IVA 19%)" }));
    expect(lines[2]).toEqual(expect.objectContaining({ taxType: "EXCLUDED", description: "Descuento (sin IVA)" }));
    const sum = lines.reduce((s, l) => s + lineTotal(l), 0);
    expect(Math.abs(sum - 10_000)).toBeLessThanOrEqual(0.02);
  });

  it("uses a single excluded line when the concept is not taxable (intereses de mora)", () => {
    const lines = noteLinesFromAmount({ amount: 5_000, description: "Intereses", saleLines: [{ taxPercent: 19, total: 119_000 }], taxable: false });
    expect(lines).toEqual([{ code: "NOTA-1", description: "Intereses", quantity: 1, unitPrice: 5_000, taxPercent: 0, taxType: "EXCLUDED" }]);
  });

  it("treats a sale with only excluded items as excluded", () => {
    const lines = noteLinesFromAmount({ amount: 3_000, description: "Ajuste", saleLines: [{ taxPercent: 0, total: 50_000 }], taxable: true });
    expect(lines).toEqual([expect.objectContaining({ unitPrice: 3_000, taxPercent: 0, taxType: "EXCLUDED" })]);
  });
});

describe("splitProviderNumber", () => {
  it("splits Factus numbers into prefix and number", () => {
    expect(splitProviderNumber("CRTE1933")).toEqual({ prefix: "CRTE", number: 1933 });
    expect(splitProviderNumber("SEDS984001650")).toEqual({ prefix: "SEDS", number: 984001650 });
    expect(splitProviderNumber("ND618")).toEqual({ prefix: "ND", number: 618 });
  });

  it("returns null when there is no trailing number", () => {
    expect(splitProviderNumber("SIN-NUMERO")).toBeNull();
  });
});
