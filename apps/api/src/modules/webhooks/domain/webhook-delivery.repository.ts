export interface WebhookDeliveryRecord {
  id: string;
  webhookSubscriptionId: string;
  eventType: string;
  payload: unknown;
  responseStatus: number | null;
  success: boolean;
  errorMessage: string | null;
  attemptedAt: Date;
}

export interface RecordDeliveryData {
  webhookSubscriptionId: string;
  eventType: string;
  payload: unknown;
  responseStatus: number | null;
  success: boolean;
  errorMessage?: string;
}

export interface IWebhookDeliveryRepository {
  record(data: RecordDeliveryData): Promise<WebhookDeliveryRecord>;
  list(webhookSubscriptionId: string): Promise<WebhookDeliveryRecord[]>;
  findByIdOrThrow(id: string): Promise<WebhookDeliveryRecord>;
}
