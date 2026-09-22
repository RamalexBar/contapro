import type { ElectronicInvoiceWithXml } from "../domain/electronic-invoice.repository";
import type { ElectronicCreditNoteWithXml } from "../domain/electronic-credit-note.repository";
import type { ElectronicDebitNoteWithXml } from "../domain/electronic-debit-note.repository";
import type { ElectronicSupportDocumentWithXml } from "../domain/electronic-support-document.repository";
import type { ElectronicPayrollWithXml } from "../domain/electronic-payroll.repository";
import type { DianDocumentType, NumberingResolutionRecord } from "../domain/invoice-numbering-resolution.repository";
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
  issuer: RideIssuer;
  counterpartyLabel: string;
  counterparty: { documentType?: string; documentNumber: string; name: string };
  lines: ExtractedLine[];
  subtotal?: string;
  taxTotal?: string;
  total: string;
  qrPayload: string;
  /** Null solo para nomina electronica (numeracion separada, sin InvoiceNumberingResolution --
   * ver README del modulo, punto 12). Para los otros 4 tipos, null unicamente si la resolucion ya
   * no existe en el momento de imprimir (no deberia pasar en la practica). */
  resolution: RideResolutionInfo | null;
}

/** nit/legalName siguen viniendo del XML ya firmado (identidad legal del documento, no cambia
 * despues de emitido) -- el resto son datos de visualizacion tomados de la Company EN VIVO al
 * momento de imprimir (Company.address/municipality/department/taxRegime/fiscalResponsibilities),
 * agregados 2026-09-22 a pedido del usuario porque el Anexo Tecnico DIAN exige mostrarlos en el
 * encabezado de la representacion grafica y hasta ahora solo se mostraba nit+razon social. */
export interface RideIssuer {
  nit: string;
  legalName: string;
  address?: string;
  municipality?: string;
  department?: string;
  taxRegime?: string;
  fiscalResponsibilities?: string;
  phone?: string;
  email?: string;
}

/** Datos de la resolucion DIAN vigente para el tipo de documento, para el bloque "Resolucion DIAN
 * No. X, autoriza del PREFIJO-desde al PREFIJO-hasta, vigente hasta FECHA" que exige el Anexo
 * Tecnico en el encabezado -- antes no se mostraba en absoluto. */
export interface RideResolutionInfo {
  resolutionNumber: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  validFrom: Date;
  validUntil: Date;
}

/** Subconjunto de Company que estos mappers necesitan para completar RideIssuer -- se pasa desde
 * el controller (ya hace su propia lectura de Company para otros PDFs, ver
 * getCompanyOrThrow en suppliers.controller.ts, mismo criterio). */
export interface RideCompanyInfo {
  address: string | null;
  municipality: string | null;
  department: string | null;
  taxRegime: string | null;
  fiscalResponsibilities: string | null;
  phone: string | null;
  email: string | null;
}

function withCompanyInfo(issuer: { nit: string; legalName: string }, company: RideCompanyInfo): RideIssuer {
  return {
    nit: issuer.nit,
    legalName: issuer.legalName,
    address: company.address ?? undefined,
    municipality: company.municipality ?? undefined,
    department: company.department ?? undefined,
    taxRegime: company.taxRegime ?? undefined,
    fiscalResponsibilities: company.fiscalResponsibilities ?? undefined,
    phone: company.phone ?? undefined,
    email: company.email ?? undefined,
  };
}

/** Ubica, entre las resoluciones de la empresa, la que emitio este numero -- por prefijo + rango
 * (una empresa puede tener resoluciones vencidas/reemplazadas ademas de la vigente, asi que no
 * basta con tomar "la activa"). Best-effort para el RIDE (NO OFICIAL): si no encuentra calce
 * exacto de rango, cae al primer prefijo que coincida. Compartida por el controller (PDFs on
 * demand) y SendInvoiceWhatsAppUseCase (envio automatico), ver ambos call-sites. */
export function findResolutionForFullNumber(
  resolutions: NumberingResolutionRecord[],
  documentType: DianDocumentType,
  fullNumber: string
): RideResolutionInfo | null {
  const candidates = resolutions.filter((r) => r.documentType === documentType && fullNumber.startsWith(r.prefix));
  const exact = candidates.find((r) => {
    const n = Number(fullNumber.slice(r.prefix.length));
    return Number.isFinite(n) && n >= r.rangeFrom && n <= r.rangeTo;
  });
  const match = exact ?? candidates[0];
  if (!match) return null;
  return {
    resolutionNumber: match.resolutionNumber,
    prefix: match.prefix,
    rangeFrom: match.rangeFrom,
    rangeTo: match.rangeTo,
    validFrom: match.validFrom,
    validUntil: match.validUntil,
  };
}

/** Cadena best-effort para el QR -- formato SIN VERIFICAR contra el Anexo Tecnico DIAN (que
 * ademas exige una URL de consulta publica no disponible sin credenciales de produccion), ver
 * README del modulo. */
function buildQrPayload(fullNumber: string, issueDate: Date, issuerNit: string, total: string, uniqueCode: string): string {
  const dateStr = issueDate.toISOString().slice(0, 10);
  return `NumFac:${fullNumber}|FecFac:${dateStr}|NitFac:${issuerNit}|ValFac:${total}|${uniqueCode}`;
}

export function mapInvoiceToRideData(doc: ElectronicInvoiceWithXml, company: RideCompanyInfo, resolution: RideResolutionInfo | null): RideDocumentData {
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
    issuer: withCompanyInfo({ nit: parsed.supplier.documentNumber, legalName: parsed.supplier.name }, company),
    counterpartyLabel: "Adquiriente",
    counterparty: parsed.customer,
    lines: parsed.lines,
    subtotal: parsed.subtotal,
    taxTotal: parsed.taxAmount,
    total,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.supplier.documentNumber, total, doc.cufe),
    resolution,
  };
}

export function mapNoteToRideData(
  doc: ElectronicCreditNoteWithXml | ElectronicDebitNoteWithXml,
  kind: "CREDIT" | "DEBIT",
  company: RideCompanyInfo,
  resolution: RideResolutionInfo | null,
): RideDocumentData {
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
    issuer: withCompanyInfo({ nit: parsed.supplier.documentNumber, legalName: parsed.supplier.name }, company),
    counterpartyLabel: "Adquiriente",
    counterparty: parsed.customer,
    lines: reason ? [{ description: reason, total }] : [],
    subtotal: parsed.subtotal,
    taxTotal: parsed.taxAmount,
    total,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.supplier.documentNumber, total, uniqueCode),
    resolution,
  };
}

/** Documento soporte: roles invertidos respecto a factura (la propia empresa es
 * AccountingCustomerParty, el proveedor es AccountingSupplierParty -- ver
 * ubl-support-document-xml-builder.ts). Sin lineas: ese builder no las incluye hoy (hueco
 * preexistente, ver README) -- el RIDE muestra solo el resumen de totales. */
export function mapSupportDocumentToRideData(doc: ElectronicSupportDocumentWithXml, company: RideCompanyInfo, resolution: RideResolutionInfo | null): RideDocumentData {
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
    issuer: withCompanyInfo({ nit: parsed.customer.documentNumber, legalName: parsed.customer.name }, company),
    counterpartyLabel: "Proveedor",
    counterparty: parsed.supplier,
    lines: [],
    subtotal: parsed.subtotal,
    taxTotal: parsed.taxAmount,
    total,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.customer.documentNumber, total, doc.cuds),
    resolution,
  };
}

/** Nomina no tiene InvoiceNumberingResolution (numeracion propia, ver README punto 12) --
 * resolution siempre null aqui. */
export function mapPayrollToRideData(doc: ElectronicPayrollWithXml, company: RideCompanyInfo): RideDocumentData {
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
    issuer: withCompanyInfo(parsed.employer, company),
    counterpartyLabel: "Trabajador",
    counterparty: { documentType: parsed.employee.documentType, documentNumber: parsed.employee.documentNumber, name: parsed.employee.fullName },
    lines: [...parsed.earnings, ...parsed.deductions],
    subtotal: parsed.grossTotal,
    taxTotal: parsed.totalDeductions,
    total: netPay,
    qrPayload: buildQrPayload(doc.fullNumber, doc.issueDate, parsed.employer.nit, netPay, doc.cune),
    resolution: null,
  };
}
