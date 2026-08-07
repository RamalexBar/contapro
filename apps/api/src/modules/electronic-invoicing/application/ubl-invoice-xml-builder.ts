export interface UblInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface UblWithholdingTax {
  type: "RETEFUENTE" | "RETEICA" | "RETEIVA";
  base: number;
  percent: number;
  amount: number;
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
  withholdingTaxes: UblWithholdingTax[];
  // Multi-moneda informativa (item 33 de docs/ALCANCE.md): solo afecta este encabezado -- todos
  // los montos (`currencyID="COP"` en LineExtensionAmount/TaxAmount/PayableAmount/etc.) siguen en
  // COP sin importar este campo, la DIAN exige el valor legal de la factura en COP.
  currency?: string;
}

/**
 * Codigos de esquema DIAN para el bloque WithholdingTaxTotal (distinto de TaxTotal, que es
 * IVA/INC/ICA generado). NO verificados contra el Anexo Tecnico real -- mismo aviso que el resto
 * de este modulo (CUFE, XAdES, RIDE): son la convencion mas citada para estos 3 conceptos, pero
 * sin credenciales de habilitacion no hay forma de confirmarlos contra el servicio real de la
 * DIAN. Ver README del modulo.
 */
const WITHHOLDING_TAX_SCHEME_ID: Record<UblWithholdingTax["type"], string> = {
  RETEFUENTE: "06",
  RETEIVA: "07",
  RETEICA: "08",
};

const WITHHOLDING_TAX_SCHEME_NAME: Record<UblWithholdingTax["type"], string> = {
  RETEFUENTE: "ReteRenta",
  RETEIVA: "ReteIVA",
  RETEICA: "ReteICA",
};

function buildWithholdingTaxTotal(w: UblWithholdingTax): string {
  return `
  <cac:WithholdingTaxTotal>
    <cbc:TaxAmount currencyID="COP">${w.amount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="COP">${w.base.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="COP">${w.amount.toFixed(2)}</cbc:TaxAmount>
      <cbc:Percent>${w.percent}</cbc:Percent>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>${WITHHOLDING_TAX_SCHEME_ID[w.type]}</cbc:ID>
          <cbc:Name>${WITHHOLDING_TAX_SCHEME_NAME[w.type]}</cbc:Name>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:WithholdingTaxTotal>`;
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
  const currency = input.currency ?? "COP";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:ID>${escapeXml(input.fullNumber)}</cbc:ID>
  <cbc:UUID schemeName="CUFE-SHA384">${input.cufe}</cbc:UUID>
  <cbc:IssueDate>${issueDateStr}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>
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
  </cac:TaxTotal>${input.withholdingTaxes.map(buildWithholdingTaxTotal).join("")}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${input.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${input.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${input.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="COP">${input.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;
}
