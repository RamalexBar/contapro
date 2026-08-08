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

/**
 * Tirilla termica (80mm de ancho, altura variable segun el contenido) para imprimir en el
 * mostrador con una impresora termica comun -- la mayoria de esas impresoras se instalan como una
 * impresora normal del sistema operativo (driver del fabricante), asi que un PDF angosto impreso
 * a escala 100% desde el navegador/lector de PDF sale correcto en el rollo, sin necesidad de
 * hablarle a la impresora en ESC/POS directamente. Mismos datos que renderRidePdf (RideDocumentData),
 * layout de una sola columna en vez del de dos columnas de la version A4. Misma advertencia de
 * representacion NO OFICIAL que renderRidePdf.
 */

const THERMAL_WIDTH = 226.77; // 80mm en puntos (72pt = 1 pulgada)
const THERMAL_MARGIN = 12;
const THERMAL_QR_SIZE = 100;

function estimateThermalHeight(data: RideDocumentData): number {
  const headerHeight = 120;
  const perLineHeight = 26; // descripcion + cant/precio/total en su propio renglon
  const totalsHeight = 50;
  const qrBlockHeight = THERMAL_QR_SIZE + 45;
  const footerHeight = 40;
  const habilitacionBanner = data.environment === "HABILITACION" ? 18 : 0;
  // +15% de colchon: mejor que sobre un poco de papel en blanco a que el contenido se corte o
  // pdfkit agregue una segunda pagina (ver test "single-page" en pdfkit-ride-renderer.spec.ts).
  const raw = headerHeight + data.lines.length * perLineHeight + totalsHeight + qrBlockHeight + footerHeight + habilitacionBanner;
  return Math.round(raw * 1.15);
}

export async function renderThermalReceiptPdf(data: RideDocumentData): Promise<Buffer> {
  const qrPngBuffer = await QRCode.toBuffer(data.qrPayload, { margin: 1, width: THERMAL_QR_SIZE });

  const doc = new PDFDocument({ size: [THERMAL_WIDTH, estimateThermalHeight(data)], margin: THERMAL_MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - THERMAL_MARGIN * 2;

  function twoCol(left: string, right: string, opts?: { bold?: boolean; size?: number }) {
    const size = opts?.size ?? 7;
    doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    const y = doc.y;
    doc.text(left, THERMAL_MARGIN, y, { width: pageWidth * 0.55 });
    doc.text(right, THERMAL_MARGIN + pageWidth * 0.55, y, { width: pageWidth * 0.45, align: "right" });
    doc.moveDown(0.4);
    // Las dos llamadas de arriba posicionan x explicitamente -- sin este reset, doc.x queda a
    // mitad de pagina y una llamada de texto "flotante" (sin x/y explicitos) despues de esta
    // hereda ese x, generando un cuadro de texto corrido hacia la derecha que en pdfkit puede
    // recortar contenido en vez de solo desbordar. Bug real encontrado: el CUFE quedaba truncado
    // en la tirilla por exactamente esto (ver pdfkit-ride-renderer.spec.ts).
    doc.x = THERMAL_MARGIN;
  }

  if (data.environment === "HABILITACION") {
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#999999");
    doc.text("AMBIENTE DE HABILITACION - NO VALIDO COMO FACTURA", { width: pageWidth, align: "center" });
    doc.fillColor("black");
    doc.moveDown(0.3);
  }

  doc.fontSize(11).font("Helvetica-Bold").text(data.issuer.legalName || "(razon social no disponible)", { width: pageWidth, align: "center" });
  doc.fontSize(8).font("Helvetica").text(`NIT: ${data.issuer.nit || "-"}`, { width: pageWidth, align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica-Bold").text(data.documentTypeLabel, { width: pageWidth, align: "center" });
  doc.fontSize(8).font("Helvetica").text(`No. ${data.fullNumber}`, { width: pageWidth, align: "center" });
  doc.moveDown(0.4);

  doc.fontSize(7).font("Helvetica");
  doc.text(`Fecha: ${formatDate(data.issueDate)}`, { width: pageWidth });
  doc.text(`${data.counterpartyLabel}: ${data.counterparty.name || "-"}`, { width: pageWidth });
  doc.text(`${data.counterparty.documentType ?? "Doc."}: ${data.counterparty.documentNumber || "-"}`, { width: pageWidth });
  doc.moveDown(0.3);
  doc.moveTo(THERMAL_MARGIN, doc.y).lineTo(THERMAL_MARGIN + pageWidth, doc.y).strokeColor("#000000").stroke();
  doc.moveDown(0.3);

  for (const line of data.lines) {
    doc.fontSize(7).font("Helvetica-Bold").text(line.description, THERMAL_MARGIN, doc.y, { width: pageWidth });
    const qtyPrice = line.quantity ? `${line.quantity} x ${formatMoney(line.unitPrice)}` : "";
    twoCol(qtyPrice, formatMoney(line.total));
  }

  doc.moveTo(THERMAL_MARGIN, doc.y).lineTo(THERMAL_MARGIN + pageWidth, doc.y).strokeColor("#000000").stroke();
  doc.moveDown(0.3);

  if (data.subtotal !== undefined) twoCol("Subtotal", formatMoney(data.subtotal));
  if (data.taxTotal !== undefined) twoCol("Impuestos/Deducciones", formatMoney(data.taxTotal));
  twoCol("TOTAL", formatMoney(data.total), { bold: true, size: 9 });
  doc.moveDown(0.4);

  const qrX = THERMAL_MARGIN + (pageWidth - THERMAL_QR_SIZE) / 2;
  const qrTop = doc.y;
  doc.image(qrPngBuffer, qrX, qrTop, { width: THERMAL_QR_SIZE, height: THERMAL_QR_SIZE });
  doc.y = qrTop + THERMAL_QR_SIZE + 6;

  doc.fontSize(6).font("Helvetica").text(`${data.uniqueCodeLabel}: ${data.uniqueCode}`, { width: pageWidth, align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(6).fillColor("#666666").text(
    "Representacion grafica no oficial, sin validar contra el Anexo Tecnico DIAN.",
    { width: pageWidth, align: "center" }
  );
  doc.fillColor("black").fontSize(8).font("Helvetica-Bold").text("GRACIAS POR SU COMPRA", { width: pageWidth, align: "center" });

  doc.end();
  return done;
}
