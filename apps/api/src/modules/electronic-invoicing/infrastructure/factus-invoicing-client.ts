import { env } from "../../../config/env";
import type { IThirdPartyInvoicingClient, ThirdPartyInvoiceInput, ThirdPartyInvoiceResult } from "../domain/third-party-invoicing-client";
import { authenticateFactus, type FactusOAuthCredentials } from "./factus-auth";

/**
 * Integracion real con Factus API (https://www.factus.com.co, docs en developers.factus.com.co)
 * -- VERIFICADA contra su sandbox real el 2026-09-18: autenticacion OAuth2 exitosa y una factura
 * de prueba real (NIT sandbox 1000789002) fue creada y devuelta con `is_validated: true` y un
 * CUFE real -- y ademas verificada de punta a punta a traves de una venta real completada en
 * Contapro (ver README del modulo).
 *
 * Notas de arquitectura: (1) autenticacion es OAuth2 "password grant" (client_id + client_secret
 * + email + password -> access_token de 1h) -- este cliente se re-autentica en cada llamada en
 * vez de cachear/refrescar el token, mas simple a costa de una llamada HTTP extra por factura.
 * (2) Factus NO acepta el prefijo/resolucion/consecutivo de Contapro directamente -- exige un
 * `numbering_range_id` (id interno que Factus asigna al crear el rango de numeracion EN SU
 * plataforma, ver factus-account-provisioning.service.ts) y es Factus quien decide el numero
 * final del documento (`data.number`, ej. "SETP990019699") -- el `invoice.fullNumber` que
 * Contapro ya reservo localmente (via InvoiceNumberingResolution) queda solo como
 * `reference_code` de correlacion, no como el numero real del documento DIAN. Mismo aviso que ya
 * existe para el CUFE local provisional vs el real del proveedor (ver
 * domain/third-party-invoicing-client.ts). (3) el XML firmado NO viene en la respuesta de
 * creacion -- hay que pedirlo aparte con GET /v2/bills/{number}/download-xml.
 *
 * `numberingRangeId` viaja empaquetado junto a las 4 credenciales OAuth2 dentro del mismo blob
 * cifrado (`Company.factusCredentialsEncrypted`, ver set-electronic-invoicing-provider.use-case.ts)
 * porque el puerto `IThirdPartyInvoicingClient.submitInvoice` solo recibe un `apiToken: string` --
 * mas simple que ampliar la firma del puerto para un solo proveedor.
 *
 * Catalogos DIAN fijados a mano (Contapro no captura estos datos por venta todavia): `document:
 * "01"` (factura de venta), `operation_type: "10"` (estandar), `payment_form: "1"` (contado) +
 * `payment_method_code: "42"` (tomado tal cual del ejemplo oficial de Factus, sin verificar
 * contra otros codigos), `unit_measure_code: "94"` (unidad), `standard_code: "999"` (estandar de
 * adopcion del contribuyente), `tribute_code: "ZZ"` (no aplica) y `responsibilities: ["R-99-PN"]`
 * (no responsable) para el comprador -- Customer no tiene hoy un regimen/responsabilidad DIAN
 * real capturado.
 */

interface FactusCredentials extends FactusOAuthCredentials {
  numberingRangeId: number;
}

interface FactusBillResponse {
  status?: string;
  message?: string;
  data?: {
    number?: string;
    cufe?: string;
    is_validated?: boolean;
    errors?: Record<string, string>;
  };
  errors?: Record<string, string[]>;
}

interface FactusXmlResponse {
  status?: string;
  data?: {
    xml_base_64_encoded?: string;
  };
}

const DOCUMENT_TYPE_INVOICE = "01";
const OPERATION_TYPE_STANDARD = "10";
const PAYMENT_FORM_CASH = "1";
const PAYMENT_METHOD_FROM_OFFICIAL_EXAMPLE = "42";
const UNIT_MEASURE_UNIT = "94";
const STANDARD_CODE_TAXPAYER_ADOPTED = "999";
const TAX_CODE_IVA = "01";
const GENERIC_TRIBUTE_CODE = "ZZ";
const GENERIC_RESPONSIBILITY = "R-99-PN";

/** DIAN: 13=Cedula ciudadania, 22=Cedula extranjeria, 31=NIT, 41=Pasaporte. */
const DOCUMENT_TYPE_CODE: Record<string, string> = { CC: "13", CE: "22", NIT: "31", PASSPORT: "41" };
/** DIAN: 1=Persona Juridica, 2=Persona Natural. */
function legalOrganizationCode(documentType: string): string {
  return documentType === "NIT" ? "1" : "2";
}

function money(value: number): string {
  return value.toFixed(2);
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildBillPayload(input: ThirdPartyInvoiceInput, numberingRangeId: number): Record<string, unknown> {
  const customer = input.customer;

  return {
    reference_code: `${input.prefix}${input.documentNumber}`,
    document: DOCUMENT_TYPE_INVOICE,
    numbering_range_id: numberingRangeId,
    operation_type: OPERATION_TYPE_STANDARD,
    send_email: false, // el envio al cliente lo maneja Contapro (email/WhatsApp), no Factus
    cash_rounding_amount: "0.00",
    payment_details: [
      {
        payment_form: PAYMENT_FORM_CASH,
        payment_method_code: PAYMENT_METHOD_FROM_OFFICIAL_EXAMPLE,
        reference_code: `${input.prefix}${input.documentNumber}-pago`,
        amount: money(input.total),
        due_date: dateOnly(input.issueDate),
      },
    ],
    customer: {
      identification_document_code: DOCUMENT_TYPE_CODE[customer.documentType] ?? DOCUMENT_TYPE_CODE.CC,
      identification: customer.documentNumber,
      names: customer.name,
      address: customer.address ?? "No informado",
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
      legal_organization_code: legalOrganizationCode(customer.documentType),
      tribute_code: GENERIC_TRIBUTE_CODE,
      country_code: "CO",
      responsibilities: [GENERIC_RESPONSIBILITY],
      municipality_code: customer.cityId ?? undefined,
    },
    items: input.lines.map((line) => ({
      code_reference: line.code,
      name: line.description,
      quantity: line.quantity.toFixed(2),
      discount_rate: "0.00",
      price: money(line.unitPrice),
      unit_measure_code: UNIT_MEASURE_UNIT,
      standard_code: STANDARD_CODE_TAXPAYER_ADOPTED,
      taxes: line.taxAmount > 0 ? [{ code: TAX_CODE_IVA, rate: line.taxPercent.toFixed(2) }] : [],
    })),
  };
}

export class FactusInvoicingClient implements IThirdPartyInvoicingClient {
  async submitInvoice(credentialsJson: string, input: ThirdPartyInvoiceInput): Promise<ThirdPartyInvoiceResult> {
    const credentials: FactusCredentials = JSON.parse(credentialsJson);

    const accessToken = await authenticateFactus(credentials);
    const billResult = await this.createBill(accessToken, input, credentials.numberingRangeId);

    if (billResult.status !== "ACCEPTED") {
      return billResult;
    }

    // El XML firmado no viene en la respuesta de creacion -- se pide aparte. Si esta segunda
    // llamada falla, la factura ya quedo creada/autorizada en Factus (irreversible), asi que se
    // devuelve igual como ACCEPTED con el XML vacio en vez de perder el CUFE ya emitido -- el
    // reenvio manual no vuelve a crear el documento (Factus lo rechazaria por reference_code
    // duplicado), asi que este hueco queda documentado como limite conocido, no auto-reintentado.
    const signedXmlContent = await this.downloadSignedXml(accessToken, billResult.rawResponse);

    return { ...billResult, signedXmlContent };
  }

  private async createBill(
    accessToken: string,
    input: ThirdPartyInvoiceInput,
    numberingRangeId: number
  ): Promise<ThirdPartyInvoiceResult & { status: "ACCEPTED" | "REJECTED" }> {
    const body = buildBillPayload(input, numberingRangeId);

    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/bills/validate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawResponse = await res.text();

    // Fallas de transporte/autenticacion (token invalido, 5xx, timeout): no son un rechazo de
    // negocio, se propagan como excepcion en vez de disfrazarse de REJECTED.
    if (res.status === 401 || res.status === 403 || res.status >= 500) {
      throw new Error(`Factus respondio ${res.status}: ${rawResponse.slice(0, 500)}`);
    }

    let parsed: FactusBillResponse;
    try {
      parsed = JSON.parse(rawResponse) as FactusBillResponse;
    } catch {
      throw new Error(`Factus devolvio una respuesta no-JSON (status ${res.status}): ${rawResponse.slice(0, 500)}`);
    }

    if (res.status === 201 && parsed.data?.is_validated && parsed.data.cufe && parsed.data.number) {
      return { status: "ACCEPTED", cufe: parsed.data.cufe, signedXmlContent: "", rawResponse };
    }

    const rejectionReason =
      parsed.message ??
      (parsed.errors ? JSON.stringify(parsed.errors) : `Respuesta inesperada de Factus (status ${res.status})`);

    return { status: "REJECTED", cufe: parsed.data?.cufe ?? "", signedXmlContent: "", rejectionReason, rawResponse };
  }

  private async downloadSignedXml(accessToken: string, rawBillResponse: string): Promise<string> {
    // El numero de documento (no el CUFE) es lo que identifica la factura para descargar el XML.
    let documentNumber: string | undefined;
    try {
      documentNumber = (JSON.parse(rawBillResponse) as FactusBillResponse).data?.number;
    } catch {
      // rawResponse ya se valido como JSON en createBill, esto no deberia pasar.
    }
    if (!documentNumber) return "";

    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/bills/${documentNumber}/download-xml`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return "";

    const raw = await res.text();
    try {
      const parsed = JSON.parse(raw) as FactusXmlResponse;
      const base64 = parsed.data?.xml_base_64_encoded;
      return base64 ? Buffer.from(base64, "base64").toString("utf-8") : "";
    } catch {
      return "";
    }
  }
}
