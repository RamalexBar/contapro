import { describe, expect, it } from "vitest";
import { buildUblInvoiceXml, type UblInvoiceInput } from "./ubl-invoice-xml-builder";

const baseInput: UblInvoiceInput = {
  fullNumber: "SETP990000001",
  cufe: "a".repeat(96),
  issueDate: new Date("2026-08-05T15:30:00.000Z"),
  environment: "HABILITACION",
  issuer: { nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." },
  buyer: { documentType: "CC", documentNumber: "1023456789", name: "Laura Gomez" },
  subtotal: 100000,
  taxTotal: 19000,
  total: 119000,
  items: [{ description: "Arroz 500g", quantity: 2, unitPrice: 5000, taxPercent: 19, taxAmount: 1900, total: 10000 }],
  withholdingTaxes: [],
};

describe("buildUblInvoiceXml", () => {
  it("does not emit any WithholdingTaxTotal block when there are no retentions", () => {
    const xml = buildUblInvoiceXml(baseInput);
    expect(xml).not.toContain("<cac:WithholdingTaxTotal>");
  });

  it("emits one WithholdingTaxTotal block per retention type, with the correct DIAN scheme id/name", () => {
    const xml = buildUblInvoiceXml({
      ...baseInput,
      withholdingTaxes: [
        { type: "RETEFUENTE", base: 100000, percent: 2.5, amount: 2500 },
        { type: "RETEICA", base: 100000, percent: 1, amount: 1000 },
        { type: "RETEIVA", base: 19000, percent: 15, amount: 2850 },
      ],
    });

    expect(xml.match(/<cac:WithholdingTaxTotal>/g)).toHaveLength(3);
    expect(xml).toContain("<cbc:ID>06</cbc:ID>");
    expect(xml).toContain("<cbc:Name>ReteRenta</cbc:Name>");
    expect(xml).toContain("<cbc:ID>08</cbc:ID>");
    expect(xml).toContain("<cbc:Name>ReteICA</cbc:Name>");
    expect(xml).toContain("<cbc:ID>07</cbc:ID>");
    expect(xml).toContain("<cbc:Name>ReteIVA</cbc:Name>");
    expect(xml).toContain("2500.00");
    expect(xml).toContain("1000.00");
    expect(xml).toContain("2850.00");
  });

  it("keeps LegalMonetaryTotal at the gross total even when retentions are present (informative, not a legal deduction)", () => {
    const xml = buildUblInvoiceXml({
      ...baseInput,
      withholdingTaxes: [{ type: "RETEFUENTE", base: 100000, percent: 2.5, amount: 2500 }],
    });

    expect(xml).toContain('<cbc:PayableAmount currencyID="COP">119000.00</cbc:PayableAmount>');
  });
});

describe("buildUblInvoiceXml — DocumentCurrencyCode (item 33 de docs/ALCANCE.md)", () => {
  it("defaults to COP when no currency is given", () => {
    const xml = buildUblInvoiceXml(baseInput);
    expect(xml).toContain("<cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>");
  });

  it("reflects a foreign currency in the header while amounts stay in COP", () => {
    const xml = buildUblInvoiceXml({ ...baseInput, currency: "USD" });
    expect(xml).toContain("<cbc:DocumentCurrencyCode>USD</cbc:DocumentCurrencyCode>");
    expect(xml).toContain('<cbc:PayableAmount currencyID="COP">119000.00</cbc:PayableAmount>');
  });
});
