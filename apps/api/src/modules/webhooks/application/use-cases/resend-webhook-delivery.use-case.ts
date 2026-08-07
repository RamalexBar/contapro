import type { AuditService } from "../../../audit/application/audit.service";
import type { IWebhookDeliveryRepository } from "../../domain/webhook-delivery.repository";
import type { WebhookDispatcherService } from "../webhook-dispatcher.service";

export class ResendWebhookDeliveryUseCase {
  constructor(
    private readonly deliveryRepo: IWebhookDeliveryRepository,
    private readonly dispatcher: WebhookDispatcherService,
    private readonly audit: AuditService
  ) {}

  async execute(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findByIdOrThrow(deliveryId);

    await this.dispatcher.dispatchToSubscription(delivery.webhookSubscriptionId, delivery.eventType, delivery.payload);

    await this.audit.record({
      action: "WEBHOOK_DELIVERY_RESENT",
      entityType: "WebhookDelivery",
      entityId: delivery.id,
      description: `Entrega de webhook reenviada: ${delivery.eventType}`,
    });
  }
}
