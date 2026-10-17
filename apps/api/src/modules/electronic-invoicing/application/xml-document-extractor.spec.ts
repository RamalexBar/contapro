import { describe, expect, it } from "vitest";
import { extractUblDocument } from "./xml-document-extractor";
import { mapInvoiceToRideData } from "./ride-data-mapper";
import type { ElectronicInvoiceWithXml } from "../domain/electronic-invoice.repository";

// Recorte del XML firmado que devuelve Factus (sandbox, 2026-10-15): numero legal, ambiente de
// pruebas, QR de la DIAN y resolucion dentro de sts:InvoiceControl.
const FACTUS_SIGNED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><sts:DianExtensions>
    <sts:InvoiceControl>
      <sts:InvoiceAuthorization>18760000001</sts:InvoiceAuthorization>
      <sts:AuthorizationPeriod><cbc:StartDate>2019-01-19</cbc:StartDate><cbc:EndDate>2030-01-19</cbc:EndDate></sts:AuthorizationPeriod>
      <sts:AuthorizedInvoices><sts:Prefix>SETP</sts:Prefix><sts:From>990000000</sts:From><sts:To>995000000</sts:To></sts:AuthorizedInvoices>
    </sts:InvoiceControl>
    <sts:QRCode>https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=abc123</sts:QRCode>
  </sts:DianExtensions></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>
  <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ProfileExecutionID>2</cbc:ProfileExecutionID>
  <cbc:ID>SETP990026311</cbc:ID>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme>
    <cbc:RegistrationName>Empresa Prueba</cbc:RegistrationName><cbc:CompanyID>1000789002</cbc:CompanyID>
  </cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyTaxScheme>
    <cbc:RegistrationName>Comprador Prueba</cbc:RegistrationName><cbc:CompanyID schemeName="13">067198594</cbc:CompanyID>
  </cac:PartyTaxScheme></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="COP">62700.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">330000.00</cbc:LineExtensionAmount>
    <cbc:PayableAmount currencyID="COP">392700.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity>30.00</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="COP">330000.00</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="COP">62700.00</cbc:TaxAmount>
      <cac:TaxSubtotal><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent></cac:TaxCategory></cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item><cbc:Description>Aceite Girasol 1L</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="COP">11000.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

describe("extractUblDocument con el XML firmado de Factus", () => {
  it("reads the legal number, test environment, DIAN QR, resolution and line taxes", () => {
    const parsed = extractUblDocument(FACTUS_SIGNED_XML);

    expect(parsed.documentNumber).toBe("SETP990026311");
    expect(parsed.environment).toBe("HABILITACION");
    expect(parsed.qrCode).toContain("catalogo-vpfe-hab.dian.gov.co");
    expect(parsed.resolution).toMatchObject({ resolutionNumber: "18760000001", prefix: "SETP", rangeFrom: 990000000, rangeTo: 995000000 });
    expect(parsed.lines[0]).toMatchObject({ taxPercent: "19.00", taxAmount: "62700.00", unitPrice: "11000.00" });
  });

  it("reads a NIT buyer with its check digit from schemeName/schemeID", () => {
    const xml = FACTUS_SIGNED_XML.replace('<cbc:CompanyID schemeName="13">067198594</cbc:CompanyID>', '<cbc:CompanyID schemeID="5" schemeName="31">999200301</cbc:CompanyID>');
    expect(extractUblDocument(xml).customer).toMatchObject({ documentType: "NIT", documentNumber: "999200301-5" });
    expect(extractUblDocument(FACTUS_SIGNED_XML).customer).toMatchObject({ documentType: "CC", documentNumber: "067198594" });
  });

  it("treats ProfileExecutionID 1 as production", () => {
    const parsed = extractUblDocument(FACTUS_SIGNED_XML.replace("<cbc:ProfileExecutionID>2<", "<cbc:ProfileExecutionID>1<"));
    expect(parsed.environment).toBe("PRODUCCION");
  });

  it("prints the Factus number and QR instead of Contapro's local reference", () => {
    const doc = {
      fullNumber: "SETP19",
      cufe: "abc123",
      issueDate: new Date("2026-10-15T12:00:00Z"),
      status: "ACCEPTED",
      xmlContent: FACTUS_SIGNED_XML,
      signedXmlContent: FACTUS_SIGNED_XML,
    } as unknown as ElectronicInvoiceWithXml;

    const ride = mapInvoiceToRideData(doc, { address: null, municipality: null } as never, null);

    expect(ride.fullNumber).toBe("SETP990026311");
    expect(ride.environment).toBe("HABILITACION");
    expect(ride.qrPayload).toContain("documentkey=abc123");
    expect(ride.resolution?.resolutionNumber).toBe("18760000001");
  });
});
