import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { buildUblInvoiceXml } from "../application/ubl-invoice-xml-builder";
import { mapInvoiceToRideData, mapSaleToReceiptData } from "../application/ride-data-mapper";
import { renderRidePdf, renderThermalReceiptPdf } from "./pdfkit-ride-renderer";
import type { ElectronicInvoiceWithXml } from "../domain/electronic-invoice.repository";
import type { RideCompanyInfo, RideResolutionInfo } from "../application/ride-data-mapper";

const testCompany: RideCompanyInfo = {
  address: "Cra 45 # 12-30",
  municipality: "Manizales",
  department: "Caldas",
  taxRegime: "Responsable de IVA",
  fiscalResponsibilities: "O-13 Gran contribuyente",
  phone: "3001234567",
  email: "facturacion@minimarket.co",
};

const testResolution: RideResolutionInfo = {
  resolutionNumber: "18760000001",
  prefix: "SETP",
  rangeFrom: 990000001,
  rangeTo: 990001000,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: new Date("2027-01-01T00:00:00.000Z"),
};

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
    const pdfBuffer = await renderRidePdf(mapInvoiceToRideData(makeInvoice(), testCompany, testResolution));

    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});

describe("renderThermalReceiptPdf", () => {
  it("produces a well-formed, non-trivial, narrow (80mm) single-page PDF buffer", async () => {
    const pdfBuffer = await renderThermalReceiptPdf(mapInvoiceToRideData(makeInvoice(), testCompany, testResolution));

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
      mapInvoiceToRideData(makeInvoice({ items: manyItems, subtotal: 20000, taxTotal: 3800, total: 23800 }), testCompany, testResolution)
    );

    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect((pdfBuffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });
});

describe("renderThermalReceiptPdf — comprobante de venta sin factura electronica", () => {
  it("renders a single-page receipt without QR or CUFE", async () => {
    const data = mapSaleToReceiptData(
      {
        number: 42,
        createdAt: new Date("2026-10-12T15:00:00Z"),
        subtotal: 3500,
        discountTotal: 0,
        taxTotal: 665,
        total: 4165,
        items: [{ productName: "Arroz Diana 500g", quantity: 1, unitPrice: 3500, total: 3500 }],
        payments: [{ method: "CASH", amount: 4165 }],
        customer: null,
      },
      { nit: "900123456-7", legalName: "Tienda Demo SAS" },
      testCompany
    );

    const pdf = await renderThermalReceiptPdf(data);

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
    // Sin QR: ninguna imagen embebida.
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
  });
});

describe("renderThermalReceiptPdf — datos del negocio y logo", () => {
  it("embeds the logo and still fits long business texts on a single page", async () => {
    // Cualquier PNG valido sirve como logo de prueba.
    const logoPng = await QRCode.toBuffer("logo", { width: 200 });
    const data = mapSaleToReceiptData(
      {
        number: 7,
        createdAt: new Date("2026-10-22T15:00:00Z"),
        subtotal: 10000,
        discountTotal: 0,
        taxTotal: 0,
        total: 10000,
        items: [{ productName: "Almuerzo ejecutivo", quantity: 1, unitPrice: 10000, total: 10000 }],
        payments: [{ method: "CASH", amount: 10000 }],
        customer: null,
      },
      { nit: "1001292780", legalName: "Alexander Barrios" },
      {
        ...testCompany,
        name: "Restaurante El Roble",
        whatsapp: "3008453690",
        website: "www.elroble.com",
        instagram: "@elroble",
        receiptHeader: "Abierto de lunes a sabado de 11:00 a.m. a 3:00 p.m. Domicilios sin costo en el centro de la ciudad.",
        receiptFooter: "Gracias por preferirnos. Vuelve pronto y recomiendanos con tus amigos.",
        logoUrl: "data:image/png;base64," + logoPng.toString("base64"),
      }
    );

    expect(data.issuer.tradeName).toBe("Restaurante El Roble");
    expect(data.issuer.logo?.equals(logoPng)).toBe(true);

    const pdf = await renderThermalReceiptPdf(data);
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
  });

  it("ignores a logo that is not a stored data URL instead of failing", async () => {
    const data = mapSaleToReceiptData(
      { number: 8, createdAt: new Date(), subtotal: 1, discountTotal: 0, taxTotal: 0, total: 1, items: [], payments: [], customer: null },
      { nit: "1", legalName: "X" },
      { ...testCompany, logoUrl: "https://ejemplo.com/logo.png" }
    );
    expect(data.issuer.logo).toBeUndefined();
    expect((await renderThermalReceiptPdf(data)).subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
