import { describe, expect, it } from "vitest";
import { buildUblInvoiceXml } from "../application/ubl-invoice-xml-builder";
import { mapInvoiceToRideData } from "../application/ride-data-mapper";
import { renderRidePdf } from "./pdfkit-ride-renderer";
import type { ElectronicInvoiceWithXml } from "../domain/electronic-invoice.repository";

describe("renderRidePdf", () => {
  it("produces a well-formed, non-trivial PDF buffer", async () => {
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
    });
    const doc: ElectronicInvoiceWithXml = {
      id: "inv-1",
      saleId: "sale-1",
      branchId: "branch-1",
      prefix: "SETP",
      number: 1,
      fullNumber: "SETP990000001",
      cufe: "a".repeat(96),
      issueDate,
      status: "GENERATED",
      createdAt: issueDate,
      xmlContent,
      signedXmlContent: null,
      dianTrackingId: null,
      rejectionReason: null,
    };

    const pdfBuffer = await renderRidePdf(mapInvoiceToRideData(doc));

    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
