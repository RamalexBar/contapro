import PDFDocument from "pdfkit";
import { formatCOP } from "@erp/shared-utils";
import type { PayslipPdfData, PayslipPdfLine } from "../application/payslip-data-mapper";

/**
 * Desprendible de pago (documento interno para el empleado), generado con `pdfkit` -- mismo
 * enfoque que infrastructure/pdfkit-ride-renderer.ts en electronic-invoicing (Node puro, sin
 * navegador headless). NO es el RIDE de nomina electronica DIAN (ese ya existe, ver
 * electronic-invoicing/README.md); este es el comprobante que recibe el empleado.
 */

const PAGE_MARGIN = 50;

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function renderLinesTable(doc: PDFKit.PDFDocument, title: string, lines: PayslipPdfLine[], total: number, pageWidth: number): void {
  doc.font("Helvetica-Bold").fontSize(10).text(title, PAGE_MARGIN, doc.y);
  doc.moveDown(0.3);

  const colLabel = PAGE_MARGIN;
  const colAmount = PAGE_MARGIN + pageWidth * 0.7;

  doc.font("Helvetica").fontSize(9);
  if (lines.length === 0) {
    doc.fillColor("#666666").text("(sin conceptos)", colLabel);
    doc.fillColor("black");
  }
  for (const line of lines) {
    const rowY = doc.y;
    doc.text(line.label, colLabel, rowY, { width: colAmount - colLabel });
    doc.text(formatCOP(line.amount), colAmount, rowY, { width: PAGE_MARGIN + pageWidth - colAmount, align: "right" });
    doc.moveDown(0.4);
  }

  doc.moveDown(0.2);
  doc.moveTo(colAmount, doc.y).lineTo(PAGE_MARGIN + pageWidth, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text(`Total ${title.toLowerCase()}`, colLabel, doc.y, { width: colAmount - colLabel });
  doc.text(formatCOP(total), colAmount, doc.y, { width: PAGE_MARGIN + pageWidth - colAmount, align: "right" });
  doc.moveDown(1);
}

export async function renderPayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;

  doc.fontSize(14).font("Helvetica-Bold").text(data.company.name || "(razon social no disponible)");
  doc.fontSize(9).font("Helvetica").text(`NIT: ${data.company.nit || "-"}`);
  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").text("Desprendible de Pago", { align: "center" });
  doc.fontSize(9).font("Helvetica").text(`Periodo: ${formatDate(data.periodStart)} a ${formatDate(data.periodEnd)}`, { align: "center" });
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(10).text("Trabajador");
  doc.font("Helvetica").fontSize(9);
  doc.text(data.employee.fullName);
  doc.text(`${data.employee.documentType}: ${data.employee.documentNumber}`);
  doc.text(`Cargo: ${data.employee.position}`);
  doc.text(`Tipo de contrato: ${data.employee.contractType}`);
  doc.text(`Dias trabajados en el periodo: ${data.daysWorked}`);
  doc.moveDown(1);

  renderLinesTable(doc, "Devengados", data.earnings, data.grossTotal, pageWidth);
  renderLinesTable(doc, "Deducciones", data.deductions, data.totalDeductions, pageWidth);

  doc.moveDown(0.5);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + pageWidth, doc.y).strokeColor("#000000").stroke();
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(12);
  doc.text("Neto a pagar", PAGE_MARGIN, doc.y, { width: pageWidth * 0.7 });
  doc.text(formatCOP(data.netPay), PAGE_MARGIN + pageWidth * 0.7, doc.y - 14, { width: pageWidth * 0.3, align: "right" });

  doc.moveDown(2);
  doc.fontSize(7).font("Helvetica").fillColor("#666666");
  doc.text(
    `Generado el ${formatDate(data.generatedAt)}. Documento interno de la empresa, no constituye factura ` +
      "ni comprobante fiscal DIAN.",
    PAGE_MARGIN,
    doc.y,
    { width: pageWidth }
  );

  doc.end();
  return done;
}
