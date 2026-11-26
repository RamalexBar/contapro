import PDFDocument from "pdfkit";
import { formatCOP } from "@erp/shared-utils";
import type { IncomeCertificate, WithholdingCertificate, WithholdingType } from "../application/certificates";
import type { CertificateIssuer } from "../domain/exogena-data.reader";

/**
 * PDFs de los certificados tributarios (mismo enfoque pdfkit que el desprendible de nomina). Llevan la
 * leyenda del art. 10 del Decreto 836 de 1991: los certificados generados por computador no requieren
 * firma autografa.
 */

const MARGIN = 50;

const TYPE_LABEL: Record<WithholdingType, string> = {
  RETEFUENTE: "Retencion en la fuente a titulo de renta",
  RETEIVA: "Retencion de IVA",
  RETEICA: "Retencion de ICA",
};

function formatDate(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function money(amount: number): string {
  return formatCOP(Math.round(amount));
}

function startDoc(): { doc: PDFKit.PDFDocument; done: Promise<Buffer>; width: number } {
  const doc = new PDFDocument({ size: "LETTER", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  return { doc, done, width: doc.page.width - MARGIN * 2 };
}

function place(issuer: CertificateIssuer): string {
  return [issuer.municipality, issuer.department].filter(Boolean).join(", ") || "-";
}

function nitWithDv(issuer: CertificateIssuer): string {
  // Hay empresas con el DV ya pegado al NIT ("900123456-7"): no se repite.
  if (!issuer.dv || issuer.nit.includes("-")) return issuer.nit;
  return `${issuer.nit}-${issuer.dv}`;
}

/** Bloque de dos columnas etiqueta/valor. */
function field(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, w: number): void {
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text(label, x, y, { width: w });
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("black").text(value || "-", x, y + 10, { width: w });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, width: number): void {
  doc.moveDown(0.8);
  const y = doc.y;
  doc.rect(MARGIN, y, width, 16).fill("#eef2f7");
  doc.fillColor("#1f2937").font("Helvetica-Bold").fontSize(9).text(title, MARGIN + 6, y + 4, { width: width - 12 });
  doc.fillColor("black");
  doc.y = y + 22;
}

function issuerBlock(doc: PDFKit.PDFDocument, issuer: CertificateIssuer, width: number): void {
  const y = doc.y;
  const half = width / 2;
  field(doc, "Razon social", issuer.legalName, MARGIN, y, half - 10);
  field(doc, "NIT", nitWithDv(issuer), MARGIN + half, y, half);
  field(doc, "Direccion", issuer.address ?? "", MARGIN, y + 30, half - 10);
  field(doc, "Municipio", place(issuer), MARGIN + half, y + 30, half);
  doc.y = y + 58;
}

function footer(doc: PDFKit.PDFDocument, width: number, issuedAt: Date, note: string): void {
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(8).fillColor("#444444");
  doc.text(note, MARGIN, doc.y, { width });
  doc.moveDown(0.6);
  doc.text(
    "Este certificado se expide sin firma autografa, de conformidad con el articulo 10 del Decreto 836 de 1991.",
    MARGIN,
    doc.y,
    { width }
  );
  doc.moveDown(0.4);
  doc.text(`Fecha de expedicion: ${formatDate(issuedAt)}`, MARGIN, doc.y, { width });
  doc.fillColor("black");
}

export async function renderWithholdingCertificatePdf(
  cert: WithholdingCertificate,
  issuer: CertificateIssuer,
  issuedAt: Date
): Promise<Buffer> {
  const { doc, done, width } = startDoc();

  doc.font("Helvetica-Bold").fontSize(14).text("CERTIFICADO DE RETENCIONES", { align: "center" });
  doc.font("Helvetica").fontSize(10).text(`Año gravable ${cert.year} · Periodo: 01/01/${cert.year} a 31/12/${cert.year}`, { align: "center" });

  sectionTitle(doc, "AGENTE RETENEDOR", width);
  issuerBlock(doc, issuer, width);

  sectionTitle(doc, "BENEFICIARIO DEL PAGO (A QUIEN SE LE PRACTICO LA RETENCION)", width);
  {
    const y = doc.y;
    const half = width / 2;
    field(doc, "Nombre o razon social", cert.supplier.name, MARGIN, y, half - 10);
    field(doc, cert.supplier.documentType || "Documento", cert.supplier.documentNumber, MARGIN + half, y, half);
    doc.y = y + 30;
  }

  sectionTitle(doc, "CONCEPTOS", width);
  const cols = { concept: MARGIN, base: MARGIN + width * 0.5, rate: MARGIN + width * 0.7, amount: MARGIN + width * 0.8 };
  const colW = { concept: width * 0.5 - 8, base: width * 0.2 - 8, rate: width * 0.1 - 4, amount: width * 0.2 };
  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#555555");
  doc.text("Concepto", cols.concept, y, { width: colW.concept });
  doc.text("Base sometida", cols.base, y, { width: colW.base, align: "right" });
  doc.text("Tarifa", cols.rate, y, { width: colW.rate, align: "right" });
  doc.text("Valor retenido", cols.amount, y, { width: colW.amount, align: "right" });
  doc.fillColor("black");
  y += 14;

  for (const type of ["RETEFUENTE", "RETEIVA", "RETEICA"] as WithholdingType[]) {
    const lines = cert.lines.filter((l) => l.type === type);
    if (lines.length === 0) continue;
    doc.font("Helvetica-Bold").fontSize(8.5).text(TYPE_LABEL[type], cols.concept, y, { width });
    y += 13;
    doc.font("Helvetica").fontSize(9);
    for (const l of lines) {
      const h = doc.heightOfString(l.conceptName, { width: colW.concept - 10 });
      doc.text(l.conceptName, cols.concept + 10, y, { width: colW.concept - 10 });
      doc.text(money(l.base), cols.base, y, { width: colW.base, align: "right" });
      doc.text(l.ratePercent != null ? `${l.ratePercent}%` : "Varias", cols.rate, y, { width: colW.rate, align: "right" });
      doc.text(money(l.amount), cols.amount, y, { width: colW.amount, align: "right" });
      y += Math.max(h, 11) + 4;
    }
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text(`Total ${TYPE_LABEL[type].toLowerCase()}`, cols.concept + 10, y, { width: colW.concept + colW.base });
    doc.text(money(cert.totals[type]), cols.amount, y, { width: colW.amount, align: "right" });
    y += 18;
  }
  doc.moveTo(MARGIN, y).lineTo(MARGIN + width, y).strokeColor("#999999").stroke();
  y += 6;
  doc.font("Helvetica-Bold").fontSize(10).text("TOTAL RETENIDO", cols.concept, y, { width: colW.concept });
  doc.text(money(cert.totals.total), cols.amount, y, { width: colW.amount, align: "right" });
  doc.y = y + 16;

  footer(
    doc,
    width,
    issuedAt,
    `Los valores retenidos fueron declarados y consignados oportunamente a favor de la DIAN (retencion en la fuente e IVA) ` +
      `y del municipio correspondiente (ICA), en ${place(issuer)}. Certificado expedido en cumplimiento del articulo 381 ` +
      `del Estatuto Tributario.`
  );

  doc.end();
  return done;
}

export async function renderIncomeCertificatePdf(cert: IncomeCertificate, issuer: CertificateIssuer, issuedAt: Date): Promise<Buffer> {
  const { doc, done, width } = startDoc();

  doc.font("Helvetica-Bold").fontSize(13).text("CERTIFICADO DE INGRESOS Y RETENCIONES", { align: "center" });
  doc.font("Helvetica-Bold").fontSize(10).text("POR RENTAS DE TRABAJO Y DE PENSIONES", { align: "center" });
  doc.font("Helvetica").fontSize(9).text(`Año gravable ${cert.year} · Informacion del formulario 220 de la DIAN`, { align: "center" });

  sectionTitle(doc, "RETENEDOR", width);
  issuerBlock(doc, issuer, width);

  sectionTitle(doc, "TRABAJADOR", width);
  {
    const y = doc.y;
    const q = width / 4;
    field(doc, "Tipo de documento", cert.documentType, MARGIN, y, q - 10);
    field(doc, "Numero de identificacion", cert.documentNumber, MARGIN + q, y, q - 10);
    field(doc, "Apellidos", [cert.firstSurname, cert.secondSurname].filter(Boolean).join(" "), MARGIN + q * 2, y, q - 10);
    field(doc, "Nombres", [cert.firstName, cert.otherNames].filter(Boolean).join(" "), MARGIN + q * 3, y, q);
    field(doc, "Periodo de la certificacion", `${formatDate(cert.periodFrom)} a ${formatDate(cert.periodTo)}`, MARGIN, y + 30, q * 2 - 10);
    field(doc, "Lugar donde se practico la retencion", `${place(issuer)}${cert.municipalityCode ? ` (${cert.municipalityCode})` : ""}`, MARGIN + q * 2, y + 30, q * 2);
    doc.y = y + 58;
  }

  const row = (label: string, amount: number, bold = false) => {
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    const h = doc.heightOfString(label, { width: width * 0.72 });
    doc.text(label, MARGIN + 6, y, { width: width * 0.72 });
    doc.text(money(amount), MARGIN + width * 0.72, y, { width: width * 0.28 - 6, align: "right" });
    doc.y = y + Math.max(h, 11) + 5;
  };

  sectionTitle(doc, "CONCEPTO DE LOS INGRESOS", width);
  row("Pagos por salarios", cert.pagosSalarios);
  row("Pagos por prestaciones sociales", cert.pagosPrestacionesSociales);
  row("Otros pagos (incapacidades, licencias, indemnizaciones)", cert.otrosPagos);
  row("Cesantias e intereses de cesantias efectivamente pagadas al empleado", cert.cesantiasInteresesPagados);
  row("Cesantias consignadas al fondo de cesantias", cert.cesantiasConsignadasFondo);
  row("Total de ingresos brutos", cert.totalIngresosBrutos, true);

  sectionTitle(doc, "CONCEPTO DE LOS APORTES Y RETENCIONES", width);
  row("Aportes obligatorios por salud a cargo del trabajador", cert.aportesSalud);
  row("Aportes obligatorios a fondos de pensiones y solidaridad pensional a cargo del trabajador", cert.aportesPensionFsp);
  row("Valor de la retencion en la fuente por rentas de trabajo y pensiones", cert.retencionFuente, true);

  footer(
    doc,
    width,
    issuedAt,
    "Certificado expedido por el empleador como agente retenedor (articulo 378 del Estatuto Tributario). Los datos a cargo " +
      "del trabajador (bienes poseidos, dependientes) no se diligencian aqui: si los necesita para su declaracion de renta, " +
      "debe completarlos el trabajador."
  );

  doc.end();
  return done;
}
