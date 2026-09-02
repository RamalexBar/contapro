import { env } from "../../../config/env";
import type { IThirdPartyInvoicingClient, ThirdPartyInvoiceInput, ThirdPartyInvoiceResult } from "../domain/third-party-invoicing-client";

/**
 * Integracion real con MATIAS API (https://matias-api.com, docs en docs.matias-api.com) --
 * VERIFICADA contra su entorno de pruebas: una factura de prueba real (empresa NIT 42017028) fue
 * enviada con este mismo formato de request y autorizada por la DIAN via MATIAS, devolviendo un
 * XML UBL 2.1 firmado (XAdES) real. A diferencia de dian-soap-client.ts, esto NO es "mejor
 * entendimiento documentado sin verificar" -- es un contrato confirmado con requests reales.
 *
 * MATIAS recibe datos de factura en JSON (NO el XML ya construido/firmado como IDianClient) y el
 * mismo genera el CUFE, arma el XML UBL, lo firma y lo transmite a la DIAN -- todo en la misma
 * llamada sincrona (sin submit+poll como el envio directo). El CUFE devuelto es
 * `response.XmlDocumentKey`, confirmado identico al `cbc:UUID schemeName="CUFE-SHA384"` dentro
 * del propio XML.
 *
 * `Accept: application/json` es obligatorio: sin ese header, un request invalido devuelve un 302
 * redirect en vez de JSON de error (comportamiento observado empiricamente en la prueba, no
 * documentado explicitamente por MATIAS).
 *
 * Catalogos de linea (quantity_units_id/type_item_identifications_id/reference_price_id) fijos a
 * los valores del ejemplo oficial de MATIAS que se probo con exito (unidad generica / precio de
 * referencia estandar) -- Contapro no tiene hoy un mapeo de unidad de producto a este catalogo,
 * ver README del modulo. payment_method_id/means_payment_id igual: MATIAS exige `payments[]` pero
 * Contapro no captura medio de pago DIAN por venta, se asume "contado" (valor del mismo ejemplo
 * verificado) hasta que se modele ese dato.
 */
const TYPE_DOCUMENT_ID_INVOICE = 7;
const OPERATION_TYPE_ID_STANDARD = 1;
const LINE_QUANTITY_UNITS_ID = "1093";
const LINE_TYPE_ITEM_IDENTIFICATIONS_ID = "4";
const LINE_REFERENCE_PRICE_ID = "1";
const PAYMENT_METHOD_ID_CASH = 1;
const MEANS_PAYMENT_ID_OTHER = 10;

interface MatiasInvoiceResponseBody {
  success: boolean;
  message?: string;
  response?: {
    IsValid?: string;
    StatusCode?: string;
    StatusDescription?: string;
    StatusMessage?: string;
    XmlDocumentKey?: string;
  };
  XmlDocumentKey?: string;
  XmlBase64Bytes?: string;
  errors?: Record<string, string[]>;
}

function money(value: number): string {
  return value.toFixed(2);
}

function buildRequestBody(input: ThirdPartyInvoiceInput): Record<string, unknown> {
  const customer = input.customer;

  return {
    resolution_number: input.resolutionNumber,
    prefix: input.prefix,
    document_number: String(input.documentNumber),
    graphic_representation: 0, // Contapro ya genera su propio RIDE (pdfkit-ride-renderer.ts)
    send_email: 0, // el envio al cliente lo maneja Contapro (email/WhatsApp), no MATIAS
    operation_type_id: OPERATION_TYPE_ID_STANDARD,
    type_document_id: TYPE_DOCUMENT_ID_INVOICE,
    payments: [{ payment_method_id: PAYMENT_METHOD_ID_CASH, means_payment_id: MEANS_PAYMENT_ID_OTHER, value_paid: money(input.total) }],
    customer: {
      dni: customer.documentNumber,
      company_name: customer.name,
      email: customer.email ?? undefined,
      mobile: customer.phone ?? undefined,
      address: customer.address ?? undefined,
      postal_code: customer.postalCode ?? undefined,
      identity_document_id: customer.identityDocumentId ?? undefined,
      type_organization_id: customer.typeOrganizationId ?? undefined,
      tax_regime_id: customer.taxRegimeId ?? undefined,
      tax_level_id: customer.taxLevelId ?? undefined,
      country_id: customer.countryId ?? undefined,
      city_id: customer.cityId ?? undefined,
    },
    lines: input.lines.map((line) => ({
      description: line.description,
      code: line.code,
      invoiced_quantity: String(line.quantity),
      quantity_units_id: LINE_QUANTITY_UNITS_ID,
      type_item_identifications_id: LINE_TYPE_ITEM_IDENTIFICATIONS_ID,
      reference_price_id: LINE_REFERENCE_PRICE_ID,
      free_of_charge_indicator: false,
      price_amount: money(line.unitPrice),
      base_quantity: String(line.quantity),
      line_extension_amount: money(line.unitPrice * line.quantity),
      tax_totals: line.taxAmount > 0 ? [{ tax_id: "1", tax_amount: line.taxAmount, taxable_amount: line.unitPrice * line.quantity, percent: line.taxPercent }] : [],
    })),
    legal_monetary_totals: {
      line_extension_amount: money(input.subtotal),
      tax_exclusive_amount: money(input.subtotal),
      tax_inclusive_amount: money(input.total),
      payable_amount: input.total,
    },
    tax_totals: input.taxTotal > 0 ? [{ tax_id: "1", tax_amount: input.taxTotal, taxable_amount: input.subtotal, percent: 19 }] : [],
  };
}

export class MatiasInvoicingClient implements IThirdPartyInvoicingClient {
  async submitInvoice(apiToken: string, input: ThirdPartyInvoiceInput): Promise<ThirdPartyInvoiceResult> {
    const body = buildRequestBody(input);

    const res = await fetch(`${env.MATIAS_BASE_URL}/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawResponse = await res.text();

    // Fallas de transporte/autenticacion (token invalido, 5xx, timeout, etc.): no son un rechazo
    // de negocio, se propagan como excepcion para que el caller (GenerateElectronicInvoiceUseCase)
    // deje la factura en GENERATED-sin-enviar y se pueda reintentar via resubmit -- mismo criterio
    // que el resto del modulo (no bloquea la venta, pero tampoco se disfraza de REJECTED).
    if (res.status === 401 || res.status === 403 || res.status >= 500) {
      throw new Error(`MATIAS respondio ${res.status}: ${rawResponse.slice(0, 500)}`);
    }

    let parsed: MatiasInvoiceResponseBody;
    try {
      parsed = JSON.parse(rawResponse) as MatiasInvoiceResponseBody;
    } catch {
      throw new Error(`MATIAS devolvio una respuesta no-JSON (status ${res.status}): ${rawResponse.slice(0, 500)}`);
    }

    const statusCode = parsed.response?.StatusCode;
    const cufe = parsed.XmlDocumentKey ?? parsed.response?.XmlDocumentKey;

    if (res.ok && parsed.success && statusCode === "00" && cufe && parsed.XmlBase64Bytes) {
      return {
        status: "ACCEPTED",
        cufe,
        signedXmlContent: Buffer.from(parsed.XmlBase64Bytes, "base64").toString("utf-8"),
        rawResponse,
      };
    }

    // Rechazo de negocio (422 con campos faltantes, o la DIAN/MATIAS rechazo el documento):
    // resultado valido, no una excepcion -- se guarda como REJECTED con el motivo real.
    const rejectionReason =
      parsed.response?.StatusMessage ??
      parsed.response?.StatusDescription ??
      parsed.message ??
      (parsed.errors ? JSON.stringify(parsed.errors) : `Respuesta inesperada de MATIAS (status ${res.status})`);

    return { status: "REJECTED", cufe: cufe ?? "", signedXmlContent: "", rejectionReason, rawResponse };
  }
}
