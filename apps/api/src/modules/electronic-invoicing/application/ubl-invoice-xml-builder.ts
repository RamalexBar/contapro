export interface UblInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface UblInvoiceInput {
  fullNumber: string;
  cufe: string;
  issueDate: Date;
  environment: "HABILITACION" | "PRODUCCION";
  issuer: { nit: string; legalName: string };
  buyer: { documentType: string; documentNumber: string; name: string };
  subtotal: number;
  taxTotal: number;
  total: number;
  items: UblInvoiceLine[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildLine(item: UblInvoiceLine, index: number): string {
  return `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity>${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="COP">${item.total.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="COP">${item.taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cbc:Percent>${item.taxPercent}</cbc:Percent>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${escapeXml(item.description)}</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
}

/**
 * Construye un XML con forma de UBL 2.1 (factura electronica de venta) a partir de una venta ya
 * facturada localmente. NO esta validado contra el XSD oficial de la DIAN y NO incluye el
 * bloque de firma XAdES (ver README del modulo) -- sirve solo como artefacto inspeccionable
 * localmente en esta iteracion, no como documento listo para envio real.
 */
export function buildUblInvoiceXml(input: UblInvoiceInput): string {
  const issueDateStr = input.issueDate.toISOString().slice(0, 10);
  const profileLabel =
    input.environment === "PRODUCCION"
      ? "DIAN 2.1: Factura Electronica de Venta"
      : "DIAN 2.1: Factura Electronica de Venta (habilitacion)";
  const lines = input.items.map(buildLine).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:ID>${escapeXml(input.fullNumber)}</cbc:ID>
  <cbc:UUID schemeName="CUFE-SHA384">${input.cufe}</cbc:UUID>
  <cbc:IssueDate>${issueDateStr}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:ProfileID>${escapeXml(profileLabel)}</cbc:ProfileID>
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
    <cbc:TaxAmount currencyID="COP">${input.taxTotal.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${input.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${input.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${input.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="COP">${input.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;
}
