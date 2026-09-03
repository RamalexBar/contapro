import { describe, expect, it } from "vitest";
import { buildUblInvoiceXml } from "../application/ubl-invoice-xml-builder";
import { mapInvoiceToRideData } from "../application/ride-data-mapper";
import { renderRidePdf, renderThermalReceiptPdf } from "./pdfkit-ride-renderer";
import type { ElectronicInvoiceWithXml } from "../domain/electronic-invoice.repository";

function makeInvoice(overrides: Partial<Parameters<typeof buildUblInvoiceXml>[0]> = {}): ElectronicInvoiceWithXml {
  const issueDate = new Date("2026-07-29T15:30:00.000Z");
  const xmlContent = buildUblInvoiceXml({
    fullNumber: "SETP990000001",
    cufe: "a".repeat(96),
    issueDate,
    environment: "HABILITACION",
    issuer: { nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." },
    buyer: { documentType: "CC", documentNumber: "1023456789", name: "Laura Gomez" },
    subtotal: 100000,
    taxTotal: 19000,
    total: 119000,
    items: [{ description: "Arroz 500g", quantity: 2, unitPrice: 5000, taxPercent: 19, taxAmount: 1900, total: 10000 }],
    withholdingTaxes: [],
    ...overrides,
  });
  return {
    id: "inv-1",
    saleId: "sale-1",
    manualInvoiceId: null,
    branchId: "branch-1",
    prefix: "SETP",
    number: 1,
    fullNumber: "SETP990000001",
    resolutionNumber: "18760000001",
    cufe: "a".repeat(96),
    issueDate,
    status: "GENERATED",
    createdAt: issueDate,
    xmlContent,
    signedXmlContent: null,
    dianTrackingId: null,
    rejectionReason: null,
  };
}

describe("renderRidePdf", () => {
  it("produces a well-formed, non-trivial PDF buffer", async () => {
    const pdfBuffer = await renderRidePdf(mapInvoiceToRideData(makeInvoice()));

    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});

describe("renderThermalReceiptPdf", () => {
  it("produces a well-formed, non-trivial, narrow (80mm) single-page PDF buffer", async () => {
    const pdfBuffer = await renderThermalReceiptPdf(mapInvoiceToRideData(makeInvoice()));

    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // El ancho de pagina (226.77pt = 80mm) queda embebido en el MediaBox del PDF -- confirma que
    // salio en el layout de tirilla, no el A4 por defecto.
    expect(pdfBuffer.toString("latin1")).toContain("226.77");
    // Una sola pagina: si estimateThermalHeight() se quedara corto, pdfkit agregaria una segunda
    // pagina en vez de fallar -- este assert detecta esa regresion.
    expect((pdfBuffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });

  it("scales the page height with the number of line items instead of truncating", async () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      description: `Producto de prueba numero ${i + 1}`,
      quantity: 1,
      unitPrice: 1000,
      taxPercent: 19,
      taxAmount: 190,
      total: 1190,
    }));
    const pdfBuffer = await renderThermalReceiptPdf(
      mapInvoiceToRideData(makeInvoice({ items: manyItems, subtotal: 20000, taxTotal: 3800, total: 23800 }))
    );

    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect((pdfBuffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });
});
