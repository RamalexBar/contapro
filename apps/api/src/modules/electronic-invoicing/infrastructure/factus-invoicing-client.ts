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
 * Fijos: `document: "01"` (factura de venta), `operation_type: "10"` (estandar),
 * `unit_measure_code: "94"` (unidad), `standard_code: "999"`. Forma y medio de pago salen de los
 * pagos de la venta (ver buildPaymentDetails), y tributo/responsabilidades del comprador de
 * Customer.dianTaxRegimeId/dianTaxLevelId (por defecto "ZZ" y "R-99-PN"). Probado contra el sandbox
 * el 2026-10-17: pagos mixtos, credito con vencimiento, descuento por linea, ReteFuente y ReteIVA
 * por linea, y comprador con NIT, dv y responsabilidades.
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
    reference_code?: string;
    errors?: Record<string, string>;
    totals?: { total?: string };
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
const PAYMENT_FORM_CREDIT = "2";
/** Factura sin pagos informados (manual, API publica): consignacion, el valor de antes. */
const PAYMENT_METHOD_UNSPECIFIED_CASH = "42";
/** Medio de la parte a credito: "1" = medio de pago no definido (aceptado por el sandbox). */
const PAYMENT_METHOD_CREDIT = "1";
/** DIAN: 10 efectivo, 48 tarjeta credito (Contapro no distingue credito/debito), 47 transferencia, ZZZ otro. */
const PAYMENT_METHOD_CODE: Record<string, string> = { CASH: "10", CARD: "48", TRANSFER: "47", MIXED: "ZZZ" };
/** DIAN: 05 ReteIVA (tasa sobre el IVA), 06 ReteRenta, 07 ReteICA. */
const WITHHOLDING_CODE: Record<string, string> = { RETEIVA: "05", RETEFUENTE: "06", RETEICA: "07" };
const DEFAULT_CREDIT_DAYS = 30;
const UNIT_MEASURE_UNIT = "94";
const STANDARD_CODE_TAXPAYER_ADOPTED = "999";
const TAX_CODE_IVA = "01";
// Codigo DIAN del impuesto nacional al consumo (restaurantes, bares). NO verificado contra el
// sandbox de Factus (agregado 2026-10-13 sin credenciales) -- mismo aviso que el resto del cliente.
const TAX_CODE_INC = "04";
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

/** Digito de verificacion del NIT (algoritmo DIAN, modulo 11). */
export function nitCheckDigit(nit: string): string {
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digits = nit.replace(/\D/g, "").split("").reverse();
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * (weights[i] ?? 0), 0);
  const r = sum % 11;
  return String(r > 1 ? 11 - r : r);
}

/** "900123456-8" o "900123456" -> numero sin dv + dv (el escrito, o calculado). */
export function splitNit(documentNumber: string): { identification: string; dv: string } {
  const [base = "", written] = documentNumber.replace(/[^\d-]/g, "").split("-");
  return { identification: base, dv: written && /^\d$/.test(written) ? written : nitCheckDigit(base) };
}

const cents = (value: number) => Math.round(value * 100);

/**
 * payment_details: Factus exige que sumen el total de la factura (antes de retenciones). Los pagos
 * de la venta pueden no sumar eso: el vuelto del efectivo sobra y lo retenido no lo paga nadie. Se
 * ajusta en centavos: el sobrante se quita primero del efectivo y lo faltante se suma al ultimo pago.
 * La parte CREDIT va como forma "2" con su vencimiento.
 */
export function buildPaymentDetails(input: ThirdPartyInvoiceInput, referenceCode: string): Record<string, string>[] {
  const totalCents = cents(input.total);
  const issueDay = dateOnly(input.issueDate);
  const payments = (input.payments ?? []).filter((p) => p.amount > 0);
  if (payments.length === 0) {
    return [
      { payment_form: PAYMENT_FORM_CASH, payment_method_code: PAYMENT_METHOD_UNSPECIFIED_CASH, reference_code: `${referenceCode}-pago`, amount: money(input.total), due_date: issueDay },
    ];
  }

  const creditCents = Math.min(cents(payments.filter((p) => p.method === "CREDIT").reduce((s, p) => s + p.amount, 0)), totalCents);
  const others = payments.filter((p) => p.method !== "CREDIT").map((p) => ({ method: p.method, cents: cents(p.amount) }));

  // Sobra (vuelto): se descuenta del efectivo primero, despues de los demas desde el ultimo.
  let excess = others.reduce((s, p) => s + p.cents, 0) + creditCents - totalCents;
  const trimOrder = [...others.filter((p) => p.method === "CASH"), ...others.filter((p) => p.method !== "CASH").reverse()];
  for (const p of trimOrder) {
    if (excess <= 0) break;
    const cut = Math.min(p.cents, excess);
    p.cents -= cut;
    excess -= cut;
  }

  const details = others
    .filter((p) => p.cents > 0)
    .map((p) => ({ form: PAYMENT_FORM_CASH, method: PAYMENT_METHOD_CODE[p.method] ?? "ZZZ", cents: p.cents, dueDate: issueDay }));
  if (creditCents > 0) {
    const due = input.dueDate ?? new Date(input.issueDate.getTime() + DEFAULT_CREDIT_DAYS * 86_400_000);
    details.push({ form: PAYMENT_FORM_CREDIT, method: PAYMENT_METHOD_CREDIT, cents: creditCents, dueDate: dateOnly(due) });
  }
  // Falta (retenciones): se completa en el ultimo pago para que sumen el total.
  const missing = totalCents - details.reduce((s, d) => s + d.cents, 0);
  if (missing > 0) {
    if (details.length === 0) details.push({ form: PAYMENT_FORM_CASH, method: PAYMENT_METHOD_UNSPECIFIED_CASH, cents: 0, dueDate: issueDay });
    details[details.length - 1]!.cents += missing;
  }

  return details.map((d, i) => ({
    payment_form: d.form,
    payment_method_code: d.method,
    reference_code: `${referenceCode}-pago${i + 1}`,
    amount: (d.cents / 100).toFixed(2),
    due_date: d.dueDate,
  }));
}

function buildCustomer(customer: ThirdPartyInvoiceInput["customer"]): Record<string, unknown> {
  const documentType = customer.documentType.trim().toUpperCase();
  const nit = documentType === "NIT" ? splitNit(customer.documentNumber) : null;
  const responsibilities = (customer.taxLevelId ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter((r) => /^[OR]-\d/.test(r));

  return {
    identification_document_code: DOCUMENT_TYPE_CODE[documentType] ?? DOCUMENT_TYPE_CODE.CC,
    identification: nit ? nit.identification : customer.documentNumber,
    ...(nit ? { dv: nit.dv, company: customer.name } : {}),
    names: customer.name,
    address: customer.address ?? "No informado",
    email: customer.email ?? undefined,
    phone: customer.phone ?? undefined,
    legal_organization_code: legalOrganizationCode(documentType),
    tribute_code: customer.taxRegimeId === TAX_CODE_IVA ? TAX_CODE_IVA : GENERIC_TRIBUTE_CODE,
    country_code: "CO",
    responsibilities: responsibilities.length > 0 ? responsibilities : [GENERIC_RESPONSIBILITY],
    municipality_code: customer.cityId ?? undefined,
  };
}

/**
 * Factus no crea un documento nuevo si el reference_code ya existe: devuelve el anterior como
 * validado. Prefijo+numero solo puede repetirse (resolucion nueva que reinicia la numeracion, o el
 * sandbox compartido, donde otros usuarios ya usaron "SETP18"), asi que se le suma la fecha de
 * emision. Es estable para la misma factura, y un reenvio sigue devolviendo el mismo documento.
 */
export function factusReferenceCode(input: Pick<ThirdPartyInvoiceInput, "prefix" | "documentNumber" | "issueDate">): string {
  return `${input.prefix}${input.documentNumber}-${input.issueDate.getTime().toString(36)}`;
}

export function buildBillPayload(input: ThirdPartyInvoiceInput, numberingRangeId: number): Record<string, unknown> {
  const customer = input.customer;
  const referenceCode = factusReferenceCode(input);

  return {
    reference_code: referenceCode,
    document: DOCUMENT_TYPE_INVOICE,
    numbering_range_id: numberingRangeId,
    operation_type: OPERATION_TYPE_STANDARD,
    // Factus le envia al comprador el XML y el PDF por correo (lo que exige la DIAN); Contapro no
    // envia la factura por correo, solo por WhatsApp.
    send_email: Boolean(customer.email),
    cash_rounding_amount: "0.00",
    payment_details: buildPaymentDetails(input, referenceCode),
    customer: buildCustomer(customer),
    items: input.lines.map((line) => {
      const hasIva = line.taxAmount > 0 && line.taxType !== "INC";
      // Cada retencion de la venta se aplica a todas las lineas (ReteIVA solo a las que tienen IVA).
      const withholdings = (input.withholdings ?? [])
        .filter((w) => w.ratePercent > 0 && WITHHOLDING_CODE[w.type] && (w.type !== "RETEIVA" || hasIva))
        .map((w) => ({ code: WITHHOLDING_CODE[w.type], rate: w.ratePercent.toFixed(2) }));
      return {
        code_reference: line.code,
        name: line.description,
        quantity: line.quantity.toFixed(2),
        discount_rate: (line.discountPercent ?? 0).toFixed(2),
        price: money(line.unitPrice),
        unit_measure_code: UNIT_MEASURE_UNIT,
        standard_code: STANDARD_CODE_TAXPAYER_ADOPTED,
        taxes: line.taxAmount > 0 ? [{ code: line.taxType === "INC" ? TAX_CODE_INC : TAX_CODE_IVA, rate: line.taxPercent.toFixed(2) }] : [],
        ...(withholdings.length > 0 ? { withholding_taxes: withholdings } : {}),
      };
    }),
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
      // Si devolvio otro documento (mismo reference_code de antes), su CUFE no es el de esta venta.
      const returnedTotal = Number(parsed.data.totals?.total);
      if (parsed.data.totals?.total !== undefined && Math.abs(returnedTotal - input.total) > 1) {
        throw new Error(
          `Factus devolvio otro documento (${parsed.data.number}, total ${returnedTotal}) en vez de crear esta factura (total ${input.total})`
        );
      }
      return { status: "ACCEPTED", cufe: parsed.data.cufe, signedXmlContent: "", rawResponse };
    }

    // El detalle por campo viene en data.errors o errors; "Error de validacion" solo no dice que corregir.
    const fieldErrors = parsed.data?.errors ?? parsed.errors;
    const details = fieldErrors ? Object.values(fieldErrors).flat().join(" ") : "";
    const rejectionReason =
      [parsed.message, details].filter(Boolean).join(": ") || `Respuesta inesperada de Factus (status ${res.status})`;

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
