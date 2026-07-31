import type { ElectronicInvoiceWithXml } from "../domain/electronic-invoice.repository";
import type { ElectronicCreditNoteWithXml } from "../domain/electronic-credit-note.repository";
import type { ElectronicDebitNoteWithXml } from "../domain/electronic-debit-note.repository";
import type { ElectronicSupportDocumentWithXml } from "../domain/electronic-support-document.repository";
import type { ElectronicPayrollWithXml } from "../domain/electronic-payroll.repository";
import { extractNoteReason, extractPayrollDocument, extractUblDocument, type ExtractedLine } from "./xml-document-extractor";

/**
 * Forma unica de datos para el RIDE (PDF), compartida por los 5 tipos de documento -- ver
 * infrastructure/pdfkit-ride-renderer.ts (el layout se escribe una sola vez). Cada funcion
 * mapXxxToRideData de este archivo adapta un tipo de documento a esta forma, parseando el
 * xmlContent ya guardado (ver xml-document-extractor.ts) porque los tipos de dominio
 * *Record/*WithXml son deliberadamente minimos y no duplican comprador/totales/lineas.
 */
export interface RideDocumentData {
  documentTypeLabel: string;
  fullNumber: string;
  uniqueCodeLabel: string;
  uniqueCode: string;
  issueDate: Date;
  environment: "HABILITACION" | "PRODUCCION";
  status: string;
  signed: boolean;
  issuer: { nit: string; legalName: string };
  counterpartyLabel: string;
  counterparty: { documentType?: string; documentNumber: string; name: string };
  lines: ExtractedLine[];
  subtotal?: string;
  taxTotal?: string;
  total: string;
  qrPayload: string;
}

/** Cadena best-effort para el QR -- formato SIN VERIFICAR contra el Anexo Tecnico DIAN (que
 * ademas exige una URL de consulta publica no disponible sin credenciales de produccion), ver
 * README del modulo. */
function buildQrPayload(fullNumber: string, issueDate: Date, issuerNit: string, total: string, uniqueCode: string): string {
  const dateStr = issueDate.toISOString().slice(0, 10);
  return `NumFac:${fullNumber}|FecFac:${dateStr}|NitFac:${issuerNit}|ValFac:${total}|${uniqueCode}`;
}

export function mapInvoiceToRideData(doc: ElectronicInvoiceWithXml): RideDocumentData {
  const parsed = extractUblDocument(doc.xmlContent);
  const total = parsed.total ?? "0.00";
  return {
    documentTypeLabel: "FACTURA ELECTRONICA DE VENTA",
    fullNumber: doc.fullNumber,
    uniqueCodeLabel: "CUFE",
    uniqueCode: doc.cufe,
    issueDate: doc.issueDate,
    environment: parsed.environment,
    status: doc.status,
    signed: doc.signedXmlContent !== null,
    issuer: { nit: parsed.supplier.documentNumber, legalName: parsed.supplier.name },
    counterpartyLabel: "Adquiriente",
    counterparty: parsed.customer,
    lines: parsed.lines,
    subtotal: parsed.subtotal,
    taxTotal: parsed.taxAmount,
    total,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.supplier.documentNumber, total, doc.cufe),
  };
}

export function mapNoteToRideData(doc: ElectronicCreditNoteWithXml | ElectronicDebitNoteWithXml, kind: "CREDIT" | "DEBIT"): RideDocumentData {
  const parsed = extractUblDocument(doc.xmlContent);
  const reason = extractNoteReason(doc.xmlContent);
  const total = parsed.total ?? "0.00";
  const uniqueCode = doc.cude;
  return {
    documentTypeLabel: kind === "CREDIT" ? "NOTA CREDITO ELECTRONICA" : "NOTA DEBITO ELECTRONICA",
    fullNumber: doc.fullNumber,
    uniqueCodeLabel: "CUDE",
    uniqueCode,
    issueDate: doc.issueDate,
    environment: parsed.environment,
    status: doc.status,
    signed: doc.signedXmlContent !== null,
    issuer: { nit: parsed.supplier.documentNumber, legalName: parsed.supplier.name },
    counterpartyLabel: "Adquiriente",
    counterparty: parsed.customer,
    lines: reason ? [{ description: reason, total }] : [],
    subtotal: parsed.subtotal,
    taxTotal: parsed.taxAmount,
    total,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.supplier.documentNumber, total, uniqueCode),
  };
}

/** Documento soporte: roles invertidos respecto a factura (la propia empresa es
 * AccountingCustomerParty, el proveedor es AccountingSupplierParty -- ver
 * ubl-support-document-xml-builder.ts). Sin lineas: ese builder no las incluye hoy (hueco
 * preexistente, ver README) -- el RIDE muestra solo el resumen de totales. */
export function mapSupportDocumentToRideData(doc: ElectronicSupportDocumentWithXml): RideDocumentData {
  const parsed = extractUblDocument(doc.xmlContent);
  const total = parsed.total ?? "0.00";
  return {
    documentTypeLabel: "DOCUMENTO SOPORTE ELECTRONICO",
    fullNumber: doc.fullNumber,
    uniqueCodeLabel: "CUDS",
    uniqueCode: doc.cuds,
    issueDate: doc.issueDate,
    environment: parsed.environment,
    status: doc.status,
    signed: doc.signedXmlContent !== null,
    issuer: { nit: parsed.customer.documentNumber, legalName: parsed.customer.name },
    counterpartyLabel: "Proveedor",
    counterparty: parsed.supplier,
    lines: [],
    subtotal: parsed.subtotal,
    taxTotal: parsed.taxAmount,
    total,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.customer.documentNumber, total, doc.cuds),
  };
}

export function mapPayrollToRideData(doc: ElectronicPayrollWithXml): RideDocumentData {
  const parsed = extractPayrollDocument(doc.xmlContent);
  const netPay = parsed.netPay ?? "0.00";
  return {
    documentTypeLabel: "NOMINA ELECTRONICA (COMPROBANTE INDIVIDUAL)",
    fullNumber: doc.fullNumber,
    uniqueCodeLabel: "CUNE",
    uniqueCode: doc.cune,
    issueDate: doc.issueDate,
    environment: parsed.environment,
    status: doc.status,
    signed: doc.signedXmlContent !== null,
    issuer: parsed.employer,
    counterpartyLabel: "Trabajador",
    counterparty: { documentType: parsed.employee.documentType, documentNumber: parsed.employee.documentNumber, name: parsed.employee.fullName },
    lines: [...parsed.earnings, ...parsed.deductions],
    subtotal: parsed.grossTotal,
    taxTotal: parsed.totalDeductions,
    total: netPay,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.employer.nit, netPay, doc.cune),
  };
}
