import crypto from "node:crypto";
import { env } from "../../../config/env";
import { ValidationError } from "../../../shared/errors/app-error";
import type {
  ChargePaymentSourceInput,
  CreateCheckoutInput,
  CreatePaymentSourceInput,
  IPaymentGateway,
  WompiChargeResult,
  WompiCheckoutLink,
  WompiPaymentSource,
  WompiWebhookEvent,
} from "../domain/payment-gateway";

const CHECKOUT_BASE_URL = "https://checkout.wompi.co/p/";

/** Base de la API REST (distinta del dominio de checkout.wompi.co de arriba) -- sandbox vs
 * produccion segun WOMPI_ENVIRONMENT, mismo criterio que DIAN_ENVIRONMENT en dian-soap-client.ts. */
const API_BASE_URL: Record<"sandbox" | "production", string> = {
  sandbox: "https://sandbox.wompi.co/v1",
  production: "https://production.wompi.co/v1",
};

/**
 * Integracion real con Wompi (Bancolombia) -- sin SDK, mismo criterio que
 * dian-soap-client.ts/resend-email-notifier.ts (fetch directo o, en este caso, ni siquiera eso:
 * el cobro es un redirect firmado localmente, no una llamada HTTP saliente). El algoritmo de la
 * firma de integridad SI se verifico byte a byte contra el ejemplo publicado en
 * docs.wompi.co/en/docs/colombia/widget-checkout-web (ver el spec de este archivo); el algoritmo
 * de verificacion de webhook sigue la misma documentacion pero no se pudo confirmar contra un
 * ejemplo verbatim de la pagina (ver el spec) -- si Wompi rechaza/no dispara webhooks reales,
 * revisar aqui primero.
 *
 * createPaymentSource/chargePaymentSource (cobro recurrente) SI se probaron en vivo contra
 * sandbox.wompi.co con llaves reales: tokenizar tarjeta y crear payment_source funcionan
 * exactamente como estaban implementados. chargePaymentSource NO -- probarlo en vivo revelo que
 * POST /transactions exige `payment_method.installments` y una `signature` (mismo algoritmo que
 * buildCheckoutUrl, confirmado por la documentacion oficial: "same as Widget & Checkout Web -
 * Generate an integrity signature") que esta clase no enviaba; ya corregido abajo. No se logro
 * confirmar el cobro completo en estado APPROVED porque el WOMPI_INTEGRITY_SECRET usado en la
 * prueba fue rechazado por Wompi con los 4 ordenes de concatenacion razonables -- revisar que la
 * llave configurada en WOMPI_INTEGRITY_SECRET sea la correcta (dashboard de Wompi > Mi cuenta >
 * Secretos) antes de asumir que esta parte funciona.
 */
export class WompiPaymentGateway implements IPaymentGateway {
  buildCheckoutUrl(input: CreateCheckoutInput): WompiCheckoutLink {
    if (!env.WOMPI_PUBLIC_KEY || !env.WOMPI_INTEGRITY_SECRET) {
      // ValidationError (no Error generico): a diferencia de ResendEmailNotifier/IDianClient
      // (que solo corren desde un poller en background, el error nunca llega a una respuesta
      // HTTP), este metodo lo invoca directo un endpoint (POST /admin/subscriptions/:id/checkout)
      // -- el mensaje tiene que llegarle claro a quien hizo el request, no un 500 opaco.
      throw new ValidationError("WOMPI_PUBLIC_KEY/WOMPI_INTEGRITY_SECRET no estan configurados");
    }

    const signature = computeIntegritySignature(input.reference, input.amountInCents);

    const params = new URLSearchParams({
      "public-key": env.WOMPI_PUBLIC_KEY,
      currency: "COP",
      "amount-in-cents": String(input.amountInCents),
      reference: input.reference,
      "signature:integrity": signature,
      "customer-data:email": input.customerEmail,
    });
    if (input.redirectUrl) params.set("redirect-url", input.redirectUrl);

    return { checkoutUrl: `${CHECKOUT_BASE_URL}?${params.toString()}` };
  }

  verifyWebhookSignature(event: WompiWebhookEvent): boolean {
    if (!env.WOMPI_EVENTS_SECRET) return false;
    if (!event.signature?.properties?.length || !event.signature.checksum) return false;

    // Concatena, EN EL ORDEN QUE INDIQUE EL PROPIO EVENTO (nunca hardcodear el array de
    // properties -- Wompi documenta que puede variar), el valor de cada path dotted dentro de
    // `data`, luego el timestamp, luego la llave de eventos. Sin separador, SHA256 hex.
    const concatenatedValues = event.signature.properties.map((path) => getByPath(event.data, path)).join("");
    const raw = `${concatenatedValues}${event.timestamp}${env.WOMPI_EVENTS_SECRET}`;
    const expected = crypto.createHash("sha256").update(raw).digest("hex");

    return timingSafeEqualHex(expected, event.signature.checksum);
  }

  async createPaymentSource(input: CreatePaymentSourceInput): Promise<WompiPaymentSource> {
    if (!env.WOMPI_PRIVATE_KEY) {
      throw new ValidationError("WOMPI_PRIVATE_KEY no esta configurada -- no se puede guardar la tarjeta para pagos automaticos");
    }

    const json = await wompiRequest("/payment_sources", {
      type: "CARD",
      token: input.cardToken,
      customer_email: input.customerEmail,
      acceptance_token: input.acceptanceToken,
    });

    return {
      paymentSourceId: String(json.data.id),
      cardLastFour: json.data.public_data?.last_four ?? null,
      // Confirmado en vivo contra sandbox.wompi.co: la respuesta de POST /payment_sources NO trae
      // `card_brand` dentro de `public_data` (solo bin/last_four/card_holder/validity_ends_at/type)
      // -- a diferencia de POST /tokens/cards, que si lo trae, pero esa respuesta la ve el
      // navegador, no este backend (nunca le llega el numero de tarjeta). Se deriva del `bin` como
      // fallback razonable en vez de guardar `cardBrand: null` siempre.
      cardBrand: json.data.public_data?.card_brand ?? detectCardBrandFromBin(json.data.public_data?.bin),
    };
  }

  async chargePaymentSource(input: ChargePaymentSourceInput): Promise<WompiChargeResult> {
    if (!env.WOMPI_PRIVATE_KEY) {
      throw new ValidationError("WOMPI_PRIVATE_KEY no esta configurada -- no se puede cobrar automaticamente");
    }
    if (!env.WOMPI_INTEGRITY_SECRET) {
      throw new ValidationError("WOMPI_INTEGRITY_SECRET no esta configurada -- no se puede cobrar automaticamente");
    }

    const json = await wompiRequest("/transactions", {
      amount_in_cents: input.amountInCents,
      currency: "COP",
      customer_email: input.customerEmail,
      reference: input.reference,
      payment_source_id: Number(input.paymentSourceId),
      // Confirmado en vivo contra sandbox.wompi.co: sin estos dos campos, Wompi rechaza el
      // request ANTES de intentar cobrar nada -- "No se especifico el numero de cuotas
      // (installments)" y luego "Firma de integridad requerida no enviada". Un pago recurrente de
      // suscripcion nunca tiene cuotas (financiacion), siempre 1.
      payment_method: { type: "CARD", installments: 1 },
      signature: computeIntegritySignature(input.reference, input.amountInCents),
    });

    return { transactionId: String(json.data.id), status: String(json.data.status) };
  }
}

/** SHA256(reference + amountInCents + "COP" + integritySecret), concatenacion simple sin
 * separador, hash plano (NO HMAC) -- verificado byte a byte contra el ejemplo oficial de
 * docs.wompi.co (ver wompi-payment-gateway.spec.ts). La documentacion de POST /transactions
 * remite explicitamente a esta misma formula ("Widget & Checkout Web - Generate an integrity
 * signature") para el campo `signature`, asi que buildCheckoutUrl y chargePaymentSource comparten
 * este calculo -- solo cambia DONDE va (query param vs body). */
function computeIntegritySignature(reference: string, amountInCents: number): string {
  return crypto
    .createHash("sha256")
    .update(`${reference}${amountInCents}COP${env.WOMPI_INTEGRITY_SECRET}`)
    .digest("hex");
}

/** Heuristica por rango de BIN (primeros digitos de la tarjeta) -- Wompi no devuelve la marca en
 * POST /payment_sources (ver arriba), asi que esto es lo unico disponible server-side. Cubre las
 * redes mas comunes en Colombia; cualquier otra queda `null` (mejor que adivinar mal). */
function detectCardBrandFromBin(bin: string | undefined | null): string | null {
  if (!bin) return null;
  if (bin.startsWith("4")) return "VISA";
  const first2 = Number(bin.slice(0, 2));
  const first4 = Number(bin.slice(0, 4));
  if ((first2 >= 51 && first2 <= 55) || (first4 >= 2221 && first4 <= 2720)) return "MASTERCARD";
  if (first2 === 34 || first2 === 37) return "AMEX";
  if (first2 === 36) return "DINERS";
  return null;
}

/** POST autenticado con la llave privada (server-to-server) contra la API REST de Wompi --
 * distinto de buildCheckoutUrl (calculo local) y verifyWebhookSignature (tambien local): estas dos
 * llamadas SI salen a la red real. El shape de /payment_sources (data.id/data.public_data) SI se
 * confirmo en vivo contra sandbox.wompi.co; el de /transactions (data.id/data.status) sigue la
 * documentacion publica pero no se confirmo con una respuesta APPROVED real (ver aviso en la
 * clase, arriba) -- si esto cambia de forma, revisar aqui. */
async function wompiRequest(path: string, body: Record<string, unknown>): Promise<{ data: Record<string, any> }> {
  const baseUrl = API_BASE_URL[env.WOMPI_ENVIRONMENT];
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WOMPI_PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let json: { data?: Record<string, any>; error?: { reason?: string; messages?: unknown } };
  try {
    json = await res.json();
  } catch {
    throw new ValidationError(`Wompi respondio con un cuerpo invalido (HTTP ${res.status})`);
  }

  if (!res.ok || !json.data) {
    const reason = json.error?.reason ?? JSON.stringify(json.error?.messages ?? {}) ?? res.statusText;
    throw new ValidationError(`Wompi rechazo la solicitud: ${reason}`);
  }

  return { data: json.data };
}

function getByPath(obj: unknown, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
  return value === undefined || value === null ? "" : String(value);
}

/** Compara dos hex strings en tiempo constante -- evita filtrar por timing cuanto del checksum
 * coincide. Longitudes distintas (payload corrupto/formato inesperado) se tratan como "no
 * coincide" sin comparar, nunca como error que tumbe el webhook. */
function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a.toLowerCase(), "hex");
  const bufB = Buffer.from(b.toLowerCase(), "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
