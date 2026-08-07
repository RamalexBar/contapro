import { createHmac } from "node:crypto";
import type { IWebhookSubscriptionRepository, WebhookSubscriptionWithSecret } from "../domain/webhook-subscription.repository";
import type { IWebhookDeliveryRepository } from "../domain/webhook-delivery.repository";

/**
 * Despacha eventos salientes a las suscripciones activas de la empresa actual (item 40 de
 * docs/ALCANCE.md). Firma HMAC-SHA256 el body con el secreto de cada suscripcion (header
 * X-Webhook-Signature) -- misma direccion inversa del patron que Wompi ya usa para firmar SUS
 * webhooks hacia nosotros. Un fallo en una suscripcion no afecta a las demas ni al caller (try/
 * catch por suscripcion, siempre se registra la entrega).
 */
export class WebhookDispatcherService {
  constructor(
    private readonly subscriptionRepo: IWebhookSubscriptionRepository,
    private readonly deliveryRepo: IWebhookDeliveryRepository
  ) {}

  async dispatch(eventType: string, payload: unknown): Promise<void> {
    const subscriptions = await this.subscriptionRepo.listActiveForEvent(eventType);
    for (const subscription of subscriptions) {
      await this.send(subscription, eventType, payload);
    }
  }

  /** Reenvia a UNA suscripcion puntual (no a todas las del evento) -- usado por
   * ResendWebhookDeliveryUseCase. */
  async dispatchToSubscription(webhookSubscriptionId: string, eventType: string, payload: unknown): Promise<void> {
    const subscription = await this.subscriptionRepo.findByIdWithSecret(webhookSubscriptionId);
    await this.send(subscription, eventType, payload);
  }

  private async send(subscription: WebhookSubscriptionWithSecret, eventType: string, payload: unknown): Promise<void> {
    const body = JSON.stringify({ eventType, data: payload, timestamp: new Date().toISOString() });
    const signature = createHmac("sha256", subscription.secret).update(body).digest("hex");

    try {
      const res = await fetch(subscription.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
        body,
      });
      await this.deliveryRepo.record({
        webhookSubscriptionId: subscription.id,
        eventType,
        payload,
        responseStatus: res.status,
        success: res.ok,
      });
    } catch (err) {
      await this.deliveryRepo.record({
        webhookSubscriptionId: subscription.id,
        eventType,
        payload,
        responseStatus: null,
        success: false,
        errorMessage: (err as Error).message,
      });
    }
  }
}
