import PDFDocument from "pdfkit";
import { formatCOP } from "@erp/shared-utils";

/**
 * PDF del comprobante contable, generado con `pdfkit` -- mismo enfoque que
 * payroll/infrastructure/pdfkit-payslip-renderer.ts y electronic-invoicing/infrastructure/pdfkit-ride-renderer.ts
 * (Node puro, sin navegador headless). Documento interno de la empresa, no es un comprobante
 * fiscal DIAN (eso ya existe para venta/nota/documento soporte/nomina, ver electronic-invoicing).
 */

const PAGE_MARGIN = 50;

const TYPE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SALE: "Venta",
  RETURN: "Devolucion",
  PURCHASE: "Compra",
  PAYROLL: "Nomina",
  ADJUSTMENT: "Ajuste de caja",
  EXPENSE: "Gasto",
  SUPPLIER_PAYMENT: "Abono a proveedor",
  RECEIVABLE_COLLECTION: "Cobro a cliente",
  COMMISSION: "Comision",
  DEPRECIATION: "Depreciacion",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Confirmado",
  VOID: "Anulado",
};

export interface JournalEntryPdfLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string | null;
}

export interface JournalEntryPdfData {
  company: { name: string; nit: string };
  number: number;
  date: Date;
  description: string;
  type: string;
  status: string;
  lines: JournalEntryPdfLine[];
  generatedAt: Date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function renderJournalEntryPdf(data: JournalEntryPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;

  doc.fontSize(14).font("Helvetica-Bold").text(data.company.name || "(razon social no disponible)");
  doc.fontSize(9).font("Helvetica").text(`NIT: ${data.company.nit || "-"}`);
  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").text(`Comprobante contable #${data.number}`, { align: "center" });
  doc.fontSize(9).font("Helvetica").text(TYPE_LABELS[data.type] ?? data.type, { align: "center" });
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(10).text("Detalle");
  doc.font("Helvetica").fontSize(9);
  doc.text(`Fecha: ${formatDate(data.date)}`);
  doc.text(`Estado: ${STATUS_LABELS[data.status] ?? data.status}`);
  doc.text(`Descripcion: ${data.description}`);
  doc.moveDown(1);

  const colAccount = PAGE_MARGIN;
  const colDebit = PAGE_MARGIN + pageWidth * 0.5;
  const colCredit = PAGE_MARGIN + pageWidth * 0.72;
  const colWidth = PAGE_MARGIN + pageWidth - colCredit;

  doc.font("Helvetica-Bold").fontSize(9);
  const headerY = doc.y;
  doc.text("Cuenta", colAccount, headerY, { width: colDebit - colAccount });
  doc.text("Debito", colDebit, headerY, { width: colCredit - colDebit, align: "right" });
  doc.text("Credito", colCredit, headerY, { width: colWidth, align: "right" });
  doc.moveDown(0.3);
  doc.moveTo(colAccount, doc.y).lineTo(PAGE_MARGIN + pageWidth, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(9);
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of data.lines) {
    totalDebit += line.debit;
    totalCredit += line.credit;
    const rowY = doc.y;
    doc.text(`${line.accountCode} - ${line.accountName}`, colAccount, rowY, { width: colDebit - colAccount });
    doc.text(line.debit > 0 ? formatCOP(line.debit) : "-", colDebit, rowY, { width: colCredit - colDebit, align: "right" });
    doc.text(line.credit > 0 ? formatCOP(line.credit) : "-", colCredit, rowY, { width: colWidth, align: "right" });
    if (line.description) {
      doc.fontSize(7).fillColor("#666666").text(line.description, colAccount, doc.y, { width: colDebit - colAccount });
      doc.fillColor("black").fontSize(9);
    }
    doc.moveDown(0.5);
  }

  doc.moveDown(0.2);
  doc.moveTo(colDebit, doc.y).lineTo(PAGE_MARGIN + pageWidth, doc.y).strokeColor("#000000").stroke();
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(9);
  const totalY = doc.y;
  doc.text("Totales", colAccount, totalY, { width: colDebit - colAccount });
  doc.text(formatCOP(totalDebit), colDebit, totalY, { width: colCredit - colDebit, align: "right" });
  doc.text(formatCOP(totalCredit), colCredit, totalY, { width: colWidth, align: "right" });

  doc.moveDown(2);
  doc.fontSize(7).font("Helvetica").fillColor("#666666");
  doc.text(`Generado el ${formatDate(data.generatedAt)}. Documento interno de la empresa, no constituye comprobante fiscal DIAN.`, PAGE_MARGIN, doc.y, {
    width: pageWidth,
  });

  doc.end();
  return done;
}
