import type { IWebhookDeliveryRepository, WebhookDeliveryRecord } from "../../domain/webhook-delivery.repository";
import type { IWebhookSubscriptionRepository } from "../../domain/webhook-subscription.repository";

export class ListWebhookDeliveriesUseCase {
  constructor(
    private readonly deliveryRepo: IWebhookDeliveryRepository,
    private readonly subscriptionRepo: IWebhookSubscriptionRepository
  ) {}

  async execute(webhookSubscriptionId: string): Promise<WebhookDeliveryRecord[]> {
    // Confirma que la suscripcion pertenece al tenant actual antes de listar su historial
    // (mismo criterio que listProductPrices en price-list.container.ts).
    await this.subscriptionRepo.findByIdOrThrow(webhookSubscriptionId);
    return this.deliveryRepo.list(webhookSubscriptionId);
  }
}
