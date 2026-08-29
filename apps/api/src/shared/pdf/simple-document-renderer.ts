import PDFDocument from "pdfkit";

/**
 * Renderizador de PDF generico para documentos simples (cotizacion, orden de compra, recibos de
 * pago, comprobante de gasto, liquidacion de comisiones) -- mismo enfoque `pdfkit` que
 * payroll/infrastructure/pdfkit-payslip-renderer.ts y
 * accounting/infrastructure/pdfkit-journal-entry-renderer.ts, pero factorizado aca porque varios
 * modulos sin relacion entre si (pos/quote, suppliers, expenses, collections, commissions)
 * necesitan basicamente el mismo layout: encabezado de empresa, titulo, un set de campos
 * clave/valor, una tabla de items OPCIONAL, y un total. Documento interno de la empresa, ninguno
 * de estos es un comprobante fiscal DIAN.
 */

const PAGE_MARGIN = 50;

export interface SimpleDocumentPdfField {
  label: string;
  value: string;
}

export interface SimpleDocumentPdfItem {
  description: string;
  quantity?: string;
  unitPrice?: string;
  amount: string;
}

export interface SimpleDocumentPdfData {
  company: { name: string; nit: string };
  title: string;
  subtitle?: string;
  fields: SimpleDocumentPdfField[];
  items?: SimpleDocumentPdfItem[];
  totalLabel: string;
  total: string;
  footerNote?: string;
  generatedAt: Date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function renderSimpleDocumentPdf(data: SimpleDocumentPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;

  doc.fontSize(14).font("Helvetica-Bold").text(data.company.name || "(razon social no disponible)");
  doc.fontSize(9).font("Helvetica").text(`NIT: ${data.company.nit || "-"}`);
  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").text(data.title, { align: "center" });
  if (data.subtitle) {
    doc.fontSize(9).font("Helvetica").text(data.subtitle, { align: "center" });
  }
  doc.moveDown(1);

  doc.font("Helvetica").fontSize(9);
  for (const field of data.fields) {
    doc.text(`${field.label}: ${field.value}`);
  }
  doc.moveDown(1);

  if (data.items && data.items.length > 0) {
    const hasQuantityColumn = data.items.some((i) => i.quantity !== undefined);
    const colDesc = PAGE_MARGIN;
    const colQty = PAGE_MARGIN + pageWidth * (hasQuantityColumn ? 0.5 : 1);
    const colPrice = PAGE_MARGIN + pageWidth * (hasQuantityColumn ? 0.65 : 1);
    const colAmount = PAGE_MARGIN + pageWidth * 0.8;
    const colAmountWidth = PAGE_MARGIN + pageWidth - colAmount;

    doc.font("Helvetica-Bold").fontSize(9);
    const headerY = doc.y;
    doc.text("Descripcion", colDesc, headerY, { width: colQty - colDesc });
    if (hasQuantityColumn) {
      doc.text("Cant.", colQty, headerY, { width: colPrice - colQty, align: "right" });
      doc.text("Valor unit.", colPrice, headerY, { width: colAmount - colPrice, align: "right" });
    }
    doc.text("Total", colAmount, headerY, { width: colAmountWidth, align: "right" });
    doc.moveDown(0.3);
    doc.moveTo(colDesc, doc.y).lineTo(PAGE_MARGIN + pageWidth, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(9);
    for (const item of data.items) {
      const rowY = doc.y;
      doc.text(item.description, colDesc, rowY, { width: colQty - colDesc });
      if (hasQuantityColumn) {
        doc.text(item.quantity ?? "-", colQty, rowY, { width: colPrice - colQty, align: "right" });
        doc.text(item.unitPrice ?? "-", colPrice, rowY, { width: colAmount - colPrice, align: "right" });
      }
      doc.text(item.amount, colAmount, rowY, { width: colAmountWidth, align: "right" });
      doc.moveDown(0.5);
    }
    doc.moveDown(0.3);
    doc.moveTo(colDesc, doc.y).lineTo(PAGE_MARGIN + pageWidth, doc.y).strokeColor("#000000").stroke();
    doc.moveDown(0.3);
  }

  doc.font("Helvetica-Bold").fontSize(12);
  doc.text(data.totalLabel, PAGE_MARGIN, doc.y, { width: pageWidth * 0.7 });
  doc.text(data.total, PAGE_MARGIN + pageWidth * 0.7, doc.y - 14, { width: pageWidth * 0.3, align: "right" });

  doc.moveDown(2);
  doc.fontSize(7).font("Helvetica").fillColor("#666666");
  doc.text(
    `Generado el ${formatDate(data.generatedAt)}.${data.footerNote ? ` ${data.footerNote}` : " Documento interno de la empresa, no constituye comprobante fiscal DIAN."}`,
    PAGE_MARGIN,
    doc.y,
    { width: pageWidth }
  );

  doc.end();
  return done;
}
