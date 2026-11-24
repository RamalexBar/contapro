import { describe, expect, it } from "vitest";
import { purchaseTaxRate, supportDocumentLines } from "./create-purchase.use-case";

describe("purchaseTaxRate", () => {
  it("snaps the purchase IVA to the closest standard rate", () => {
    expect(purchaseTaxRate(100_000, 19_000)).toBe(19);
    expect(purchaseTaxRate(100_000, 18_990)).toBe(19);
    expect(purchaseTaxRate(100_000, 5_000)).toBe(5);
    expect(purchaseTaxRate(100_000, 0)).toBe(0);
  });

  it("keeps the effective rate when the purchase mixes rates", () => {
    expect(purchaseTaxRate(100_000, 12_000)).toBe(12);
  });
});

describe("supportDocumentLines", () => {
  it("uses one line per product that entered the inventory", () => {
    const lines = supportDocumentLines({ invoiceNumber: "CC-15", subtotal: 30_000, taxTotal: 0 }, [{ quantity: 3, unitCost: 10_000 }], ["Tomate"], "Compra");
    expect(lines).toEqual([{ code: "DS-1", description: "Tomate", quantity: 3, unitPrice: 10_000, taxPercent: 0 }]);
  });

  it("uses a single line for the subtotal of a service purchase", () => {
    const lines = supportDocumentLines({ invoiceNumber: "CC-16", subtotal: 300_000, taxTotal: 0 }, [], [], "Servicio");
    expect(lines).toEqual([{ code: "DS-1", description: "Servicio segun soporte CC-16", quantity: 1, unitPrice: 300_000, taxPercent: 0 }]);
  });
});
