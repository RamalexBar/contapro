import PDFDocument from "pdfkit";
import { formatCOP } from "@erp/shared-utils";
import type { BenefitSettlementRecord } from "../domain/benefit-settlement.repository";

const PAGE_MARGIN = 50;

const TITLES: Record<BenefitSettlementRecord["type"], string> = {
  SERVICE_BONUS: "Comprobante de pago de prima de servicios",
  SEVERANCE: "Liquidacion de cesantias e intereses",
  TERMINATION: "Liquidacion final de prestaciones sociales",
};

const REASONS: Record<string, string> = {
  RESIGNATION: "Renuncia voluntaria",
  JUST_CAUSE: "Despido con justa causa",
  WITHOUT_JUST_CAUSE: "Despido sin justa causa",
  END_OF_TERM: "Terminacion del plazo pactado",
  MUTUAL_AGREEMENT: "Mutuo acuerdo",
};

const CONTRACTS: Record<string, string> = {
  INDEFINITE: "Termino indefinido",
  FIXED_TERM: "Termino fijo",
  SERVICE: "Prestacion de servicios",
  LEARNING: "Aprendizaje",
};

const day = (iso: string | Date) => (typeof iso === "string" ? iso : iso.toISOString()).slice(0, 10);

/**
 * Documento de la prima, cesantias o liquidacion del contrato para que el trabajador lo revise y lo
 * firme (paz y salvo). Mismo enfoque pdfkit que el desprendible de nomina.
 */
export async function renderBenefitSettlementPdf(
  record: BenefitSettlementRecord,
  company: { name: string; nit: string },
  employee: { documentType: string; position: string; contractType: string; hireDate: Date }
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const width = doc.page.width - PAGE_MARGIN * 2;
  const s = record.detail;

  doc.fontSize(14).font("Helvetica-Bold").text(company.name);
  doc.fontSize(9).font("Helvetica").text(`NIT: ${company.nit}`);
  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").text(TITLES[record.type], { align: "center" });
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(10).text("Trabajador");
  doc.font("Helvetica").fontSize(9);
  doc.text(s.employeeName);
  doc.text(`${employee.documentType}: ${s.documentNumber}`);
  doc.text(`Cargo: ${employee.position} · Contrato: ${CONTRACTS[employee.contractType] ?? employee.contractType}`);
  doc.text(`Fecha de ingreso: ${day(employee.hireDate)}`);
  if (record.type === "TERMINATION") {
    doc.text(`Fecha de retiro: ${day(record.periodEnd)}`);
    if (record.terminationReason) doc.text(`Motivo: ${REASONS[record.terminationReason] ?? record.terminationReason}`);
  } else {
    doc.text(`Periodo: ${day(record.periodStart)} a ${day(record.periodEnd)}`);
  }
  doc.moveDown(1);

  const colDays = PAGE_MARGIN + width * 0.5;
  const colBase = PAGE_MARGIN + width * 0.62;
  const colAmount = PAGE_MARGIN + width * 0.8;
  doc.font("Helvetica-Bold").fontSize(9);
  let y = doc.y;
  doc.text("Concepto", PAGE_MARGIN, y);
  doc.text("Dias", colDays, y, { width: colBase - colDays - 6, align: "right" });
  doc.text("Base", colBase, y, { width: colAmount - colBase - 6, align: "right" });
  doc.text("Valor", colAmount, y, { width: PAGE_MARGIN + width - colAmount, align: "right" });
  doc.moveDown(0.6);
  doc.font("Helvetica");
  for (const line of s.lines) {
    y = doc.y;
    doc.text(line.label, PAGE_MARGIN, y, { width: colDays - PAGE_MARGIN - 8 });
    const after = doc.y;
    doc.text(String(line.days), colDays, y, { width: colBase - colDays - 6, align: "right" });
    doc.text(formatCOP(line.base), colBase, y, { width: colAmount - colBase - 6, align: "right" });
    doc.text(formatCOP(line.amount), colAmount, y, { width: PAGE_MARGIN + width - colAmount, align: "right" });
    doc.y = Math.max(after, doc.y);
    doc.moveDown(0.4);
  }

  const row = (label: string, value: number, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9);
    const ry = doc.y;
    doc.text(label, PAGE_MARGIN, ry, { width: width * 0.7 });
    doc.text(formatCOP(value), colAmount, ry, { width: PAGE_MARGIN + width - colAmount, align: "right" });
    doc.moveDown(0.4);
  };
  doc.moveDown(0.3);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + width, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.3);
  row("Total", s.grossTotal);
  if (s.toSeveranceFund > 0) row("Menos: cesantias que se consignan al fondo", -s.toSeveranceFund);
  if (s.withholding > 0) row("Menos: retencion en la fuente", -s.withholding);
  row("Neto a pagar al trabajador", s.netPay, true);

  if (s.notes.length > 0) {
    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(8).fillColor("#444444");
    for (const note of s.notes) doc.text(`• ${note}`, PAGE_MARGIN, doc.y, { width });
    doc.fillColor("black");
  }

  doc.moveDown(3);
  y = doc.y;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + width * 0.42, y).strokeColor("#000000").stroke();
  doc.moveTo(PAGE_MARGIN + width * 0.58, y).lineTo(PAGE_MARGIN + width, y).stroke();
  doc.fontSize(8).font("Helvetica");
  doc.text("Firma del trabajador", PAGE_MARGIN, y + 4, { width: width * 0.42 });
  doc.text("Firma del empleador", PAGE_MARGIN + width * 0.58, y + 4, { width: width * 0.42 });
  if (record.type === "TERMINATION") {
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor("#444444").text(
      "Con su firma, el trabajador declara recibir los valores aqui liquidados. Cualquier diferencia puede reclamarla dentro de los terminos de ley.",
      PAGE_MARGIN,
      doc.y,
      { width }
    );
  }

  doc.moveDown(1.5);
  doc.fontSize(7).fillColor("#666666").text(`Generado por Contapro el ${day(new Date())}.`, PAGE_MARGIN, doc.y, { width });
  doc.end();
  return done;
}
