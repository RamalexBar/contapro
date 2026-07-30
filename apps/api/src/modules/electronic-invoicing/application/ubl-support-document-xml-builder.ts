/**
 * ADVERTENCIA: esta es la parte MAS especulativa de todo el modulo DIAN. El "documento soporte"
 * no sigue necesariamente la estructura UBL "Invoice" estandar que usan facturas/notas -- la
 * DIAN documenta un esquema propio para este tipo de documento, mucho menos publicado
 * publicamente que CUFE/CUDE/UBL de factura. Esta funcion reutiliza la forma de
 * `buildUblInvoiceXml`/`buildUblNoteXml` como mejor aproximacion disponible (mismo namespace UBL
 * generico), NO como una implementacion confirmada contra el Anexo Tecnico ni el XSD real de
 * documento soporte. Tratar como placeholder hasta poder contrastar con un ejemplo real de la
 * DIAN -- mas todavia que las demas advertencias "sin verificar" del modulo.
 */
export interface UblSupportDocumentInput {
  fullNumber: string;
  cuds: string;
  issueDate: Date;
  environment: "HABILITACION" | "PRODUCCION";
  /** La propia empresa: quien EMITE el documento soporte, actuando como comprador. */
  issuer: { nit: string; legalName: string };
  /** El proveedor no obligado a facturar: la contraparte que "vendio" en esta compra. */
  supplier: { documentType: string; documentNumber: string; name: string };
  subtotal: number;
  taxTotal: number;
  total: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Construye un XML con forma de UBL para un documento soporte electronico. A diferencia de
 * `buildUblInvoiceXml`, los roles de comprador/vendedor estan invertidos: `AccountingSupplierParty`
 * es el proveedor informal (quien entrego el bien/servicio) y `AccountingCustomerParty` es la
 * propia empresa (quien emite el documento, actuando en nombre del proveedor que no puede
 * facturar). NO validado contra ningun XSD oficial de la DIAN.
 */
export function buildUblSupportDocumentXml(input: UblSupportDocumentInput): string {
  const issueDateStr = input.issueDate.toISOString().slice(0, 10);
  const profileLabel =
    input.environment === "PRODUCCION"
      ? "DIAN 2.1: Documento Soporte de Adquisiciones"
      : "DIAN 2.1: Documento Soporte de Adquisiciones (habilitacion)";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:ID>${escapeXml(input.fullNumber)}</cbc:ID>
  <cbc:UUID schemeName="CUDS-SHA384">${input.cuds}</cbc:UUID>
  <cbc:IssueDate>${issueDateStr}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>05</cbc:InvoiceTypeCode>
  <cbc:ProfileID>${escapeXml(profileLabel)}</cbc:ProfileID>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID schemeID="${escapeXml(input.supplier.documentType)}">${escapeXml(input.supplier.documentNumber)}</cbc:CompanyID>
        <cbc:RegistrationName>${escapeXml(input.supplier.name)}</cbc:RegistrationName>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(input.issuer.nit)}</cbc:CompanyID>
        <cbc:RegistrationName>${escapeXml(input.issuer.legalName)}</cbc:RegistrationName>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${input.taxTotal.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${input.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${input.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${input.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="COP">${input.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}
