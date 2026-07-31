import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { RideDocumentData } from "../application/ride-data-mapper";

/**
 * Layout unico de RIDE (representacion grafica en PDF), reusado por los 5 tipos de documento DIAN
 * -- mismo patron "motor generico + adaptador por tipo" que ya usan
 * signAndQueueElectronicDocument/PollDianSubmissionsUseCase. Generado con `pdfkit` (Node puro, sin
 * navegador headless) en vez de HTML->PDF, consistente con el resto del modulo (sobre SOAP armado
 * a mano en vez del paquete `soap`). Sin logo de empresa en esta version (evita I/O de red durante
 * el render). Es una representacion NO OFICIAL: el formato del QR y el layout en si no estan
 * validados contra el Anexo Tecnico DIAN vigente -- ver README del modulo.
 */

const PAGE_MARGIN = 50;

function formatMoney(value: string | number | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return `$ ${n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function renderRidePdf(data: RideDocumentData): Promise<Buffer> {
  const qrPngBuffer = await QRCode.toBuffer(data.qrPayload, { margin: 1, width: 140 });

  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;

  if (data.environment === "HABILITACION") {
    doc.save();
    doc.fillColor("#cccccc").fontSize(60).opacity(0.3);
    doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.text("HABILITACION - NO VALIDO COMO DOCUMENTO FISCAL", 0, doc.page.height / 2 - 30, {
      width: doc.page.width,
      align: "center",
    });
    doc.restore();
    doc.opacity(1).fillColor("black");
  }

  doc.fontSize(16).font("Helvetica-Bold").text(data.issuer.legalName || "(razon social no disponible)");
  doc.fontSize(10).font("Helvetica").text(`NIT: ${data.issuer.nit || "-"}`);
  doc.moveDown(0.5);
  doc.fontSize(14).font("Helvetica-Bold").text(data.documentTypeLabel);
  doc.moveDown(0.5);

  const infoTop = doc.y;
  doc.fontSize(10).font("Helvetica");
  doc.text(`Numero: ${data.fullNumber}`);
  doc.text(`Fecha de emision: ${formatDate(data.issueDate)}`);
  doc.text(`Ambiente: ${data.environment}`);
  doc.text(`Estado: ${data.status}${data.signed ? " (firmado)" : " (sin firmar)"}`);
  doc.text(`${data.uniqueCodeLabel}: ${data.uniqueCode}`, { width: pageWidth * 0.65 });

  doc.image(qrPngBuffer, PAGE_MARGIN + pageWidth - 140, infoTop, { width: 140, height: 140 });
  doc.moveDown(1);

  doc.fontSize(11).font("Helvetica-Bold").text(`${data.counterpartyLabel}:`);
  doc.fontSize(10).font("Helvetica");
  doc.text(data.counterparty.name || "-");
  doc.text(`${data.counterparty.documentType ?? "Doc."}: ${data.counterparty.documentNumber || "-"}`);
  doc.moveDown(1);

  if (data.lines.length > 0) {
    const colDescription = PAGE_MARGIN;
    const colQty = PAGE_MARGIN + pageWidth * 0.55;
    const colUnit = PAGE_MARGIN + pageWidth * 0.7;
    const colTotal = PAGE_MARGIN + pageWidth * 0.85;

    doc.font("Helvetica-Bold").fontSize(9);
    const headerY = doc.y;
    doc.text("Descripcion", colDescription, headerY, { width: colQty - colDescription });
    doc.text("Cant.", colQty, headerY, { width: colUnit - colQty });
    doc.text("V. Unit.", colUnit, headerY, { width: colTotal - colUnit });
    doc.text("Total", colTotal, headerY, { width: PAGE_MARGIN + pageWidth - colTotal });
    doc.moveDown(0.3);
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + pageWidth, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(9);
    for (const line of data.lines) {
      const rowY = doc.y;
      doc.text(line.description, colDescription, rowY, { width: colQty - colDescription });
      doc.text(line.quantity ?? "", colQty, rowY, { width: colUnit - colQty });
      doc.text(line.unitPrice ? formatMoney(line.unitPrice) : "", colUnit, rowY, { width: colTotal - colUnit });
      doc.text(formatMoney(line.total), colTotal, rowY, { width: PAGE_MARGIN + pageWidth - colTotal });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.5);
  }

  const totalsX = PAGE_MARGIN + pageWidth * 0.6;
  doc.font("Helvetica").fontSize(10);
  if (data.subtotal !== undefined) doc.text(`Subtotal: ${formatMoney(data.subtotal)}`, totalsX, doc.y, { width: pageWidth * 0.4 });
  if (data.taxTotal !== undefined) doc.text(`Impuestos/Deducciones: ${formatMoney(data.taxTotal)}`, totalsX, doc.y, { width: pageWidth * 0.4 });
  doc.font("Helvetica-Bold").text(`Total: ${formatMoney(data.total)}`, totalsX, doc.y, { width: pageWidth * 0.4 });

  doc.moveDown(2);
  doc.fontSize(7).font("Helvetica").fillColor("#666666");
  doc.text(
    "Representacion grafica no oficial. El codigo QR y este layout no estan validados contra el " +
      "Anexo Tecnico DIAN vigente -- ver README del modulo de facturacion electronica.",
    PAGE_MARGIN,
    doc.y,
    { width: pageWidth }
  );

  doc.end();
  return done;
}
