export type UblNoteKind = "CREDIT" | "DEBIT";

export interface UblNoteInput {
  fullNumber: string;
  cude: string;
  referenceCufe: string;
  issueDate: Date;
  environment: "HABILITACION" | "PRODUCCION";
  issuer: { nit: string; legalName: string };
  buyer: { documentType: string; documentNumber: string; name: string };
  amount: number;
  taxAmount: number;
  reason: string;
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
 * Construye un XML con forma de UBL 2.1 para notas credito/debito -- comparte estructura entre
 * ambas (`kind`) porque en UBL solo cambian el elemento raiz, el codigo de tipo y el nombre de
 * la linea; el resto (partes, totales, referencia a la factura original) es identico. NO esta
 * validado contra el XSD oficial de la DIAN y NO incluye el bloque de firma XAdES (ver README
 * del modulo) -- sirve solo como artefacto inspeccionable localmente en esta iteracion.
 * Codigos de tipo de nota sin verificar, ver application/constants.ts (DIAN_NOTE_TYPE_CODE).
 */
export function buildUblNoteXml(kind: UblNoteKind, input: UblNoteInput): string {
  const rootElement = kind === "CREDIT" ? "CreditNote" : "DebitNote";
  const lineElement = kind === "CREDIT" ? "CreditNoteLine" : "DebitNoteLine";
  const quantityElement = kind === "CREDIT" ? "CreditedQuantity" : "DebitedQuantity";
  const typeCodeElement = kind === "CREDIT" ? "CreditNoteTypeCode" : "DebitNoteTypeCode";
  const typeCode = kind === "CREDIT" ? "91" : "92";
  const issueDateStr = input.issueDate.toISOString().slice(0, 10);
  const subtotal = input.amount - input.taxAmount;
  const profileLabel =
    input.environment === "PRODUCCION"
      ? `DIAN 2.1: Nota ${kind === "CREDIT" ? "Credito" : "Debito"} Electronica`
      : `DIAN 2.1: Nota ${kind === "CREDIT" ? "Credito" : "Debito"} Electronica (habilitacion)`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootElement}-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:ID>${escapeXml(input.fullNumber)}</cbc:ID>
  <cbc:UUID schemeName="CUDE-SHA384">${input.cude}</cbc:UUID>
  <cbc:IssueDate>${issueDateStr}</cbc:IssueDate>
  <cbc:${typeCodeElement}>${typeCode}</cbc:${typeCodeElement}>
  <cbc:ProfileID>${escapeXml(profileLabel)}</cbc:ProfileID>
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${input.referenceCufe}</cbc:ReferenceID>
    <cbc:Description>${escapeXml(input.reason)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:UUID>${input.referenceCufe}</cbc:UUID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(input.issuer.nit)}</cbc:CompanyID>
        <cbc:RegistrationName>${escapeXml(input.issuer.legalName)}</cbc:RegistrationName>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID schemeID="${escapeXml(input.buyer.documentType)}">${escapeXml(input.buyer.documentNumber)}</cbc:CompanyID>
        <cbc:RegistrationName>${escapeXml(input.buyer.name)}</cbc:RegistrationName>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${input.taxAmount.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${input.amount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="COP">${input.amount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:${lineElement}>
    <cbc:ID>1</cbc:ID>
    <cbc:${quantityElement}>1</cbc:${quantityElement}>
    <cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${escapeXml(input.reason)}</cbc:Description>
    </cac:Item>
  </cac:${lineElement}>
</${rootElement}>`;
}
