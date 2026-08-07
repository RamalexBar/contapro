import type { IWebhookSubscriptionRepository, WebhookSubscriptionRecord } from "../../domain/webhook-subscription.repository";

export class ListWebhookSubscriptionsUseCase {
  constructor(private readonly repo: IWebhookSubscriptionRepository) {}

  execute(): Promise<WebhookSubscriptionRecord[]> {
    return this.repo.list();
  }
}
