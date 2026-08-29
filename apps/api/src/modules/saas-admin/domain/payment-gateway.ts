export interface CreateCheckoutInput {
  reference: string;
  amountInCents: number;
  customerEmail: string;
  redirectUrl?: string;
}

export interface WompiCheckoutLink {
  checkoutUrl: string;
}

/** Forma del evento "transaction.updated" que envia Wompi al webhook configurado en el
 * dashboard del comercio (ver docs.wompi.co/en/docs/colombia/eventos). */
export interface WompiWebhookEvent {
  event: string;
  data: {
    transaction: {
      id: string;
      status: string;
      reference: string;
      amount_in_cents: number;
    };
  };
  environment: string;
  timestamp: number;
  signature: {
    /** Rutas dotted dentro de `data` (ej. "transaction.id") -- el orden importa para el hash y
     * NO hay que asumirlo fijo, Wompi documenta que puede variar. */
    properties: string[];
    checksum: string;
  };
}

/** Tarjeta guardada ("payment source" en la jerga de Wompi) para cobrar sin que el cliente este
 * presente. `cardToken` sale de `POST /tokens/cards`, llamado SIEMPRE desde el frontend con la
 * llave publica -- el numero de tarjeta nunca toca este backend, solo el token de un solo uso que
 * resulta de tokenizarla. `acceptanceToken` sale de `GET /merchants/:publicKey` (tambien publico,
 * el frontend lo pide directo) y representa que el cliente acepto los terminos de Wompi. */
export interface CreatePaymentSourceInput {
  cardToken: string;
  customerEmail: string;
  acceptanceToken: string;
}

export interface WompiPaymentSource {
  paymentSourceId: string;
  cardLastFour: string | null;
  cardBrand: string | null;
}

/** Cobro "merchant-initiated" (sin que el cliente este presente ni redireccion) contra una
 * payment_source ya guardada -- usado por el poller de renovacion automatica. El resultado
 * sincrono de POST /transactions casi siempre viene PENDING; el estado final (APPROVED/DECLINED)
 * llega despues por el mismo webhook "transaction.updated" que ya procesa
 * ConfirmWompiPaymentUseCase, correlacionado por `reference` -- no hace falta logica nueva ahi. */
export interface ChargePaymentSourceInput {
  reference: string;
  amountInCents: number;
  customerEmail: string;
  paymentSourceId: string;
}

export interface WompiChargeResult {
  transactionId: string;
  status: string;
}

/**
 * Puerto de cobro de suscripciones via Wompi (Bancolombia). El flujo de checkout manual (Web
 * Checkout por redireccion) no requiere que el backend llame a la API de Wompi: `buildCheckoutUrl`
 * es un calculo local (firma de integridad = hash del monto/referencia/secreto) que arma la URL a
 * la que se redirige al usuario; Wompi hostea la pagina de pago y notifica el resultado via
 * webhook, que `verifyWebhookSignature` valida sin llamar a ningun servicio externo tampoco.
 *
 * `createPaymentSource`/`chargePaymentSource` (renovacion automatica) SI llaman a la API real de
 * Wompi desde el backend (WOMPI_PRIVATE_KEY, server-to-server) -- primera vez que este puerto sale
 * a la red en vez de solo firmar/verificar localmente.
 */
export interface IPaymentGateway {
  buildCheckoutUrl(input: CreateCheckoutInput): WompiCheckoutLink;
  verifyWebhookSignature(event: WompiWebhookEvent): boolean;
  createPaymentSource(input: CreatePaymentSourceInput): Promise<WompiPaymentSource>;
  chargePaymentSource(input: ChargePaymentSourceInput): Promise<WompiChargeResult>;
}
