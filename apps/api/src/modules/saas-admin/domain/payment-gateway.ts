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

/**
 * Puerto de cobro de suscripciones via Wompi (Bancolombia). El flujo real (Web Checkout por
 * redireccion) no requiere que el backend llame a la API de Wompi: `buildCheckoutUrl` es un
 * calculo local (firma de integridad = hash del monto/referencia/secreto) que arma la URL a la
 * que se redirige al usuario; Wompi hostea la pagina de pago y notifica el resultado via webhook,
 * que `verifyWebhookSignature` valida sin llamar a ningun servicio externo tampoco.
 */
export interface IPaymentGateway {
  buildCheckoutUrl(input: CreateCheckoutInput): WompiCheckoutLink;
  verifyWebhookSignature(event: WompiWebhookEvent): boolean;
}
