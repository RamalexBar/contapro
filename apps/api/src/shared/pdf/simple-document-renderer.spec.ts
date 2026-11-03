import { describe, expect, it } from "vitest";
import { renderSimpleDocumentPdf, type SimpleDocumentPdfItem } from "./simple-document-renderer";

// PNG de 1x1 valido
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// Encabezado de un WEBP (pdfkit no lo dibuja)
const WEBP = Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "latin1");

const render = (items: SimpleDocumentPdfItem[]) =>
  renderSimpleDocumentPdf({
    company: { name: "Demo SAS", nit: "900123456" },
    title: "Cotizacion",
    fields: [],
    items,
    totalLabel: "Total",
    total: "$ 10.000",
    generatedAt: new Date("2026-11-03T12:00:00Z"),
  });

const imageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Subtype \/Image/g) ?? []).length;

describe("renderSimpleDocumentPdf", () => {
  it("pone la miniatura de los renglones que traen foto", async () => {
    const pdf = await render([
      { image: PNG, description: "Aceite", quantity: "1", unitPrice: "$ 5.000", amount: "$ 5.000" },
      { description: "Arroz", quantity: "1", unitPrice: "$ 5.000", amount: "$ 5.000" },
    ]);
    expect(imageCount(pdf)).toBeGreaterThan(0);
  });

  it("sin fotos queda igual que siempre, y una foto en un formato que no se puede dibujar se omite sin romper el PDF", async () => {
    expect(imageCount(await render([{ description: "Arroz", amount: "$ 5.000" }]))).toBe(0);
    const pdf = await render([{ image: WEBP, description: "Aceite", amount: "$ 5.000" }]);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(imageCount(pdf)).toBe(0);
  });
});
