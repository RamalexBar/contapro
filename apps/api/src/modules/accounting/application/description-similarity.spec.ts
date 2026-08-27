import { describe, expect, it } from "vitest";
import { descriptionSimilarity } from "./description-similarity";

describe("descriptionSimilarity", () => {
  it("returns 1 for identical descriptions", () => {
    expect(descriptionSimilarity("Pago Proveedor Acme SAS", "Pago Proveedor Acme SAS")).toBe(1);
  });

  it("returns 0 when there is no word overlap", () => {
    expect(descriptionSimilarity("Transferencia Bancolombia", "Comprobante de nomina")).toBe(0);
  });

  it("ignores accents so 'numero' and 'número' match", () => {
    expect(descriptionSimilarity("Pago factura número 123", "Pago factura numero 123")).toBe(1);
  });

  it("ignores case and punctuation", () => {
    expect(descriptionSimilarity("PAGO, PROVEEDOR ACME.", "pago proveedor acme")).toBe(1);
  });

  it("ignores short connector words that would add false overlap", () => {
    // Comparten solo "de"/"la"/"el" -- palabras vacias de idioma, no deberian contar como señal
    expect(descriptionSimilarity("Pago de la factura", "Compra de el producto")).toBe(0);
  });

  it("returns a partial score for partial overlap", () => {
    const score = descriptionSimilarity("Transferencia Proveedor Acme SAS", "Compra Proveedor Acme mercancia");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 for empty or missing descriptions", () => {
    expect(descriptionSimilarity("", "Pago proveedor")).toBe(0);
    expect(descriptionSimilarity("Pago proveedor", "")).toBe(0);
  });
});
