import crypto from "node:crypto";
import { env } from "../../../config/env";
import { ValidationError } from "../../../shared/errors/app-error";
import type { CreateCheckoutInput, IPaymentGateway, WompiCheckoutLink, WompiWebhookEvent } from "../domain/payment-gateway";

const CHECKOUT_BASE_URL = "https://checkout.wompi.co/p/";

/**
 * Integracion real con Wompi (Bancolombia) -- sin SDK, mismo criterio que
 * dian-soap-client.ts/resend-email-notifier.ts (fetch directo o, en este caso, ni siquiera eso:
 * el cobro es un redirect firmado localmente, no una llamada HTTP saliente). NO PROBADO
 * end-to-end contra el servicio real sin WOMPI_PUBLIC_KEY/WOMPI_INTEGRITY_SECRET/
 * WOMPI_EVENTS_SECRET configurados (vacios por defecto, ver config/env.ts). El algoritmo de la
 * firma de integridad SI se verifico byte a byte contra el ejemplo publicado en
 * docs.wompi.co/en/docs/colombia/widget-checkout-web (ver el spec de este archivo); el algoritmo
 * de verificacion de webhook sigue la misma documentacion pero no se pudo confirmar contra un
 * ejemplo verbatim de la pagina (ver el spec) -- si Wompi rechaza/no dispara webhooks reales,
 * revisar aqui primero.
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

    // Firma de integridad: SHA256(reference + amountInCents + currency + integritySecret),
    // concatenacion simple sin separador, hash plano (NO HMAC) -- verificado byte a byte contra
    // el ejemplo oficial de docs.wompi.co (ver wompi-payment-gateway.spec.ts).
    const signature = crypto
      .createHash("sha256")
      .update(`${input.reference}${input.amountInCents}COP${env.WOMPI_INTEGRITY_SECRET}`)
      .digest("hex");

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
