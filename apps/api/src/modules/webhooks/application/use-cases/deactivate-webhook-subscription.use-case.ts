import type { AuditService } from "../../../audit/application/audit.service";
import type { IWebhookSubscriptionRepository, WebhookSubscriptionRecord } from "../../domain/webhook-subscription.repository";

export class DeactivateWebhookSubscriptionUseCase {
  constructor(private readonly repo: IWebhookSubscriptionRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<WebhookSubscriptionRecord> {
    const subscription = await this.repo.deactivate(id);

    await this.audit.record({
      action: "WEBHOOK_SUBSCRIPTION_DEACTIVATED",
      entityType: "WebhookSubscription",
      entityId: subscription.id,
      description: `Suscripcion de webhook desactivada: ${subscription.url}`,
    });

    return subscription;
  }
}
