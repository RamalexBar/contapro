import { describe, expect, it } from "vitest";
import { calculateNitCheckDigit, isValidCedula, isValidNit } from "./validators";

describe("calculateNitCheckDigit", () => {
  // No hay forma de verificar contra el algoritmo oficial de la DIAN sin acceso a una fuente
  // autorizada -- estos valores son los que el propio codigo produce hoy (characterization
  // tests, ver README de esta carpeta si se agrega uno). Sirven para detectar regresiones si
  // alguien toca la funcion, no como prueba de que sean los digitos de verificacion "reales".
  it("is deterministic for a known input", () => {
    expect(calculateNitCheckDigit("900123456")).toBe(8);
  });

  it("returns a value between 0 and 10", () => {
    for (const nit of ["900123456", "800197268", "1", "123456789012345", "0"]) {
      const dv = calculateNitCheckDigit(nit);
      expect(dv).toBeGreaterThanOrEqual(0);
      expect(dv).toBeLessThanOrEqual(10);
    }
  });

  it("ignores non-digit characters (dots, dashes)", () => {
    expect(calculateNitCheckDigit("900.123.456")).toBe(calculateNitCheckDigit("900123456"));
  });

  it("only uses the first 15 weighted positions (weight 0 beyond that)", () => {
    // Un NIT de 16 digitos donde el digito extra (mas significativo) cae en una posicion sin
    // peso (indice 15) no deberia cambiar el resultado frente al mismo NIT sin ese digito.
    expect(calculateNitCheckDigit("9123456789012345")).toBe(calculateNitCheckDigit("123456789012345"));
  });
});

describe("isValidNit", () => {
  it("accepts a NIT with its own correctly-computed check digit", () => {
    const nit = "900123456";
    const dv = calculateNitCheckDigit(nit);
    expect(isValidNit(`${nit}-${dv}`)).toBe(true);
  });

  it("rejects a NIT with the wrong check digit", () => {
    const nit = "900123456";
    const wrongDv = (calculateNitCheckDigit(nit) + 1) % 11;
    expect(isValidNit(`${nit}-${wrongDv}`)).toBe(false);
  });

  it("rejects input without a dash separator", () => {
    expect(isValidNit("9001234568")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidNit("")).toBe(false);
  });

  it("strips non-numeric formatting (spaces, dots) before validating", () => {
    const nit = "900123456";
    const dv = calculateNitCheckDigit(nit);
    expect(isValidNit(`900.123.456-${dv}`)).toBe(true);
  });
});

describe("isValidCedula", () => {
  it("accepts a typical cedula length (6-10 digits)", () => {
    expect(isValidCedula("1023456789")).toBe(true);
    expect(isValidCedula("123456")).toBe(true);
  });

  it("rejects too short", () => {
    expect(isValidCedula("12345")).toBe(false);
  });

  it("rejects too long", () => {
    expect(isValidCedula("12345678901")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidCedula("")).toBe(false);
  });

  it("strips non-digit formatting before checking length", () => {
    expect(isValidCedula("1.023.456-789")).toBe(true); // 10 digits once stripped
  });
});
