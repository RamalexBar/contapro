import { DOMParser } from "@xmldom/xmldom";
import type { Document as XmlDocument } from "@xmldom/xmldom";
import * as xpath from "xpath";

/**
 * Extrae datos ya presentes en el xmlContent guardado (emisor/contraparte, totales, lineas,
 * ambiente) para construir el RIDE (PDF, ver ride-data-mapper.ts). Los tipos de dominio
 * ElectronicInvoiceRecord/ElectronicCreditNoteRecord/etc son deliberadamente minimos (id,
 * fullNumber, codigo unico, status, fechas) -- el nombre del comprador, los totales, y las lineas
 * NO estan duplicados ahi, solo existen dentro del XML ya generado. Se parsea en vez de agregar
 * columnas nuevas, para no tocar los 5 repositorios Prisma ya probados. Misma convencion
 * `local-name()` (agnostica de namespace) que dian-soap-client.ts/xades-xml-signer.ts. Para tags
 * que se repiten en distintos niveles (ej. LineExtensionAmount aparece tanto en LegalMonetaryTotal
 * como dentro de cada InvoiceLine), se usa `./*` (hijo directo) en vez de `.//` para evitar
 * ambiguedad -- ver `directChild`. Los nodos se tratan como `any` (mismo criterio que
 * dian-soap-client.ts): los tipos de `xpath` y de `@xmldom/xmldom` no coinciden exactamente entre
 * si, pelear con eso no aporta seguridad de tipos real aqui.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

export interface ExtractedLine {
  description: string;
  quantity?: string;
  unitPrice?: string;
  taxPercent?: string;
  taxAmount?: string;
  total: string;
}

/** Resolucion de numeracion que viene dentro del XML firmado (sts:InvoiceControl). */
export interface ExtractedResolution {
  resolutionNumber: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  validFrom: Date;
  validUntil: Date;
}

export interface ExtractedParty {
  documentType?: string;
  documentNumber: string;
  name: string;
}

function parseXml(xmlContent: string): XmlDocument {
  return new DOMParser().parseFromString(xmlContent, "text/xml");
}

function directChild(parent: AnyNode, localName: string): AnyNode {
  if (!parent) return null;
  return xpath.select1(`./*[local-name()='${localName}']`, parent) ?? null;
}

function textOf(node: AnyNode, localName: string): string | undefined {
  if (!node) return undefined;
  const found = xpath.select1(`.//*[local-name()='${localName}']`, node);
  return (found as AnyNode)?.textContent ?? undefined;
}

function attrOf(node: AnyNode, localName: string, attrName: string): string | undefined {
  if (!node) return undefined;
  const found = xpath.select1(`.//*[local-name()='${localName}']`, node) as AnyNode;
  return typeof found?.getAttribute === "function" ? (found.getAttribute(attrName) ?? undefined) : undefined;
}

/** Codigos DIAN de tipo de documento que usa el XML firmado (schemeName). */
const DIAN_DOCUMENT_TYPE: Record<string, string> = { "13": "CC", "22": "CE", "31": "NIT", "41": "PASSPORT" };

function extractParty(root: AnyNode, partyElement: "AccountingSupplierParty" | "AccountingCustomerParty"): ExtractedParty {
  const partyNode = directChild(root, partyElement);
  const documentNumber = textOf(partyNode, "CompanyID") ?? "";
  const schemeId = attrOf(partyNode, "CompanyID", "schemeID");
  const dianType = DIAN_DOCUMENT_TYPE[attrOf(partyNode, "CompanyID", "schemeName") ?? ""];
  // XML propio: schemeID es el tipo ("CC", "NIT"). XML DIAN/Factus: schemeName es el codigo del
  // tipo y, si es NIT, schemeID es el digito de verificacion.
  if (dianType) {
    return {
      documentType: dianType,
      documentNumber: dianType === "NIT" && schemeId ? `${documentNumber}-${schemeId}` : documentNumber,
      name: textOf(partyNode, "RegistrationName") ?? "",
    };
  }
  return { documentType: schemeId, documentNumber, name: textOf(partyNode, "RegistrationName") ?? "" };
}

/** ProfileExecutionID es el dato DIAN (1 = produccion, 2 = pruebas) y lo trae el XML firmado de
 * Factus. Los XML propios no lo tienen: ahi "(habilitacion)" en el ProfileID lo escribimos nosotros
 * (ver ubl-*-xml-builder.ts / dian-payroll-xml-builder.ts). */
function environmentOf(root: AnyNode): "HABILITACION" | "PRODUCCION" {
  const executionId = directChild(root, "ProfileExecutionID")?.textContent?.trim();
  if (executionId === "1") return "PRODUCCION";
  if (executionId === "2") return "HABILITACION";
  return textOf(root, "ProfileID")?.toLowerCase().includes("habilitacion") ? "HABILITACION" : "PRODUCCION";
}

function extractResolution(root: AnyNode): ExtractedResolution | undefined {
  const control = xpath.select1(".//*[local-name()='InvoiceControl']", root) as AnyNode;
  if (!control) return undefined;
  const resolutionNumber = textOf(control, "InvoiceAuthorization");
  const prefix = textOf(control, "Prefix");
  const rangeFrom = Number(textOf(control, "From"));
  const rangeTo = Number(textOf(control, "To"));
  const validFrom = new Date(`${textOf(control, "StartDate")}T00:00:00Z`);
  const validUntil = new Date(`${textOf(control, "EndDate")}T00:00:00Z`);
  if (!resolutionNumber || prefix === undefined || !rangeFrom || !rangeTo) return undefined;
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) return undefined;
  return { resolutionNumber, prefix, rangeFrom, rangeTo, validFrom, validUntil };
}

export interface ExtractedUblDocument {
  supplier: ExtractedParty;
  customer: ExtractedParty;
  subtotal?: string;
  taxAmount?: string;
  total?: string;
  environment: "HABILITACION" | "PRODUCCION";
  lines: ExtractedLine[];
  /** cbc:ID del documento: en el XML firmado por Factus es el numero legal que asigno el proveedor. */
  documentNumber?: string;
  /** sts:QRCode del XML firmado (enlace de consulta de la DIAN), si lo trae. */
  qrCode?: string;
  resolution?: ExtractedResolution;
}

/** Factura, notas credito/debito, y documento soporte comparten forma UBL "Invoice"-like (ver
 * cada ubl-*-xml-builder.ts) -- un solo parser sirve para los 4. Documento soporte no tiene
 * InvoiceLine (hueco preexistente del builder, ver README), asi que `lines` sale vacio para ese
 * tipo. */
export function extractUblDocument(xmlContent: string): ExtractedUblDocument {
  const doc = parseXml(xmlContent);
  const root: AnyNode = doc.documentElement;
  const legalMonetaryTotal = directChild(root, "LegalMonetaryTotal");
  const taxTotal = directChild(root, "TaxTotal");
  const lineNodes: AnyNode[] = [
    ...(xpath.select("./*[local-name()='InvoiceLine']", root) as AnyNode[]),
    ...(xpath.select("./*[local-name()='CreditNoteLine']", root) as AnyNode[]),
    ...(xpath.select("./*[local-name()='DebitNoteLine']", root) as AnyNode[]),
  ];

  return {
    supplier: extractParty(root, "AccountingSupplierParty"),
    customer: extractParty(root, "AccountingCustomerParty"),
    subtotal: textOf(legalMonetaryTotal, "LineExtensionAmount"),
    taxAmount: textOf(taxTotal, "TaxAmount"),
    total: textOf(legalMonetaryTotal, "PayableAmount"),
    environment: environmentOf(root),
    documentNumber: directChild(root, "ID")?.textContent?.trim() || undefined,
    qrCode: textOf(root, "QRCode")?.trim() || undefined,
    resolution: extractResolution(root),
    lines: lineNodes.map((node) => ({
      description: textOf(node, "Description") ?? "",
      quantity: textOf(node, "InvoicedQuantity") ?? textOf(node, "CreditedQuantity") ?? textOf(node, "DebitedQuantity"),
      unitPrice: textOf(node, "PriceAmount"),
      taxPercent: textOf(node, "Percent"),
      taxAmount: textOf(directChild(node, "TaxTotal"), "TaxAmount"),
      total: textOf(node, "LineExtensionAmount") ?? "0",
    })),
  };
}

/** Notas credito/debito no tienen linea propia con descripcion libre -- el motivo vive en
 * cac:DiscrepancyResponse/cbc:Description (ver ubl-note-xml-builder.ts). */
export function extractNoteReason(xmlContent: string): string {
  const doc = parseXml(xmlContent);
  const node = xpath.select1("//*[local-name()='DiscrepancyResponse']", doc as AnyNode);
  return textOf(node, "Description") ?? "";
}

const PAYROLL_EARNING_TAGS: Record<string, string> = {
  SueldoTrabajado: "Sueldo trabajado",
  AuxilioTransporte: "Auxilio de transporte",
  HorasExtraDiurnas: "Horas extra diurnas",
  HorasExtraNocturnas: "Horas extra nocturnas",
  RecargoNocturno: "Recargo nocturno",
  RecargoDominicalFestivo: "Recargo dominical/festivo",
};

const PAYROLL_DEDUCTION_TAGS: Record<string, string> = {
  Salud: "Salud",
  FondoPension: "Fondo de pension",
  RetencionFuente: "Retencion en la fuente",
};

function extractChildLines(parent: AnyNode, tags: Record<string, string>): ExtractedLine[] {
  if (!parent) return [];
  const lines: ExtractedLine[] = [];
  for (const [tag, label] of Object.entries(tags)) {
    const value = textOf(parent, tag);
    if (value !== undefined) lines.push({ description: label, total: value });
  }
  return lines;
}

export interface ExtractedPayrollDocument {
  employer: { nit: string; legalName: string };
  employee: { documentType: string; documentNumber: string; fullName: string };
  earnings: ExtractedLine[];
  deductions: ExtractedLine[];
  grossTotal?: string;
  totalDeductions?: string;
  netPay?: string;
  environment: "HABILITACION" | "PRODUCCION";
}

/** Nomina electronica: esquema propio (no UBL), ver dian-payroll-xml-builder.ts. */
export function extractPayrollDocument(xmlContent: string): ExtractedPayrollDocument {
  const doc = parseXml(xmlContent);
  const root: AnyNode = doc.documentElement;
  const empleador = directChild(root, "Empleador");
  const trabajador = directChild(root, "Trabajador");
  const devengados = directChild(root, "Devengados");
  const deducciones = directChild(root, "Deducciones");
  const comprobante = directChild(root, "ComprobanteTotal");

  const nombre = [textOf(trabajador, "PrimerNombre"), textOf(trabajador, "OtrosNombres"), textOf(trabajador, "PrimerApellido"), textOf(trabajador, "SegundoApellido")]
    .filter(Boolean)
    .join(" ");

  return {
    employer: { nit: textOf(empleador, "NIT") ?? "", legalName: textOf(empleador, "RazonSocial") ?? "" },
    employee: {
      documentType: textOf(trabajador, "TipoDocumento") ?? "",
      documentNumber: textOf(trabajador, "NumeroDocumento") ?? "",
      fullName: nombre,
    },
    earnings: extractChildLines(devengados, PAYROLL_EARNING_TAGS),
    deductions: extractChildLines(deducciones, PAYROLL_DEDUCTION_TAGS),
    grossTotal: textOf(comprobante, "TotalDevengado"),
    totalDeductions: textOf(comprobante, "TotalDeducciones"),
    netPay: textOf(comprobante, "ComprobanteNeto"),
    environment: environmentOf(root),
  };
}
