import { describe, expect, it } from "vitest";
import { applyDiscount, calculateTax, formatCOP, round2 } from "./currency";

// Intl.NumberFormat("es-CO", { style: "currency", ... }) separa el simbolo del monto con un
// NON-BREAKING SPACE (U+00A0), no un espacio normal (U+0020) -- visualmente identicos en
// terminal/log, pero distintos en comparacion estricta de strings. Se aisla en una constante
// para que el caracter especial no quede escondido dentro de cada string esperado.
const NBSP = " ";

describe("formatCOP", () => {
  it("formats a positive amount as COP with no decimals", () => {
    expect(formatCOP(1400000)).toBe(`$${NBSP}1.400.000`);
  });

  it("formats zero", () => {
    expect(formatCOP(0)).toBe(`$${NBSP}0`);
  });

  it("formats a negative amount", () => {
    expect(formatCOP(-5000)).toBe(`-$${NBSP}5.000`);
  });

  it("rounds fractional COP to the nearest integer (maximumFractionDigits: 0)", () => {
    expect(formatCOP(1999.6)).toBe(`$${NBSP}2.000`);
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(19.999)).toBe(20);
    expect(round2(2800.4949)).toBe(2800.49);
  });

  it("handles negative numbers", () => {
    expect(round2(-2800.4949)).toBe(-2800.49);
  });

  it("leaves whole numbers unchanged", () => {
    expect(round2(100)).toBe(100);
  });

  it("inherits the classic floating-point quirk of Math.round(x*100)/100: an exact half-cent can round down instead of up because 1.005*100 is not exactly 100.5 in IEEE 754", () => {
    // 1.005 * 100 === 100.49999999999999 in JS, so this rounds to 1, not 1.01. Documented here as
    // a characterization test (locks in current behavior) rather than asserting it's "correct" --
    // fixing this would mean switching to a string-based or epsilon-corrected rounding technique,
    // which is a separate decision, not something this test suite decides on its own.
    expect(round2(1.005)).toBe(1);
  });
});

describe("calculateTax", () => {
  it("calculates 19% IVA on a base amount", () => {
    expect(calculateTax(100000, 19)).toBe(19000);
  });

  it("returns 0 for a 0% rate", () => {
    expect(calculateTax(100000, 0)).toBe(0);
  });

  it("rounds to 2 decimals", () => {
    expect(calculateTax(52631.58, 19)).toBe(10000);
  });
});

describe("applyDiscount", () => {
  it("applies a percentage discount", () => {
    expect(applyDiscount(100000, 10)).toBe(90000);
  });

  it("returns the original amount for a 0% discount", () => {
    expect(applyDiscount(50000, 0)).toBe(50000);
  });

  it("returns 0 for a 100% discount", () => {
    expect(applyDiscount(50000, 100)).toBe(0);
  });
});
