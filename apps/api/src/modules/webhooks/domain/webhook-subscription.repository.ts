export interface WebhookSubscriptionRecord {
  id: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: Date;
}

/** Solo para uso interno del despachador -- nunca se expone via HTTP despues de la creacion. */
export interface WebhookSubscriptionWithSecret extends WebhookSubscriptionRecord {
  secret: string;
}

export interface CreateWebhookSubscriptionData {
  url: string;
  eventTypes: string[];
  /** Generado por el caso de uso (random), no elegido por el usuario -- mismo criterio que
   * ApiKey.keyHash. */
  secret: string;
}

export interface IWebhookSubscriptionRepository {
  create(data: CreateWebhookSubscriptionData): Promise<WebhookSubscriptionRecord>;
  list(): Promise<WebhookSubscriptionRecord[]>;
  findByIdOrThrow(id: string): Promise<WebhookSubscriptionRecord>;
  deactivate(id: string): Promise<WebhookSubscriptionRecord>;
  /** Activas que incluyen `eventType` en `eventTypes`, CON el secreto (para firmar) -- usado
   * exclusivamente por WebhookDispatcherService, siempre dentro de un tenantStorage.run ya
   * resuelto (la accion que dispara el evento ya corre dentro del contexto del tenant). */
  listActiveForEvent(eventType: string): Promise<WebhookSubscriptionWithSecret[]>;
  /** Una sola suscripcion por id, CON el secreto -- usado solo por ResendWebhookDeliveryUseCase
   * (reenviar una entrega puntual, a diferencia de dispatch() que va a TODAS las suscripciones
   * activas del evento). */
  findByIdWithSecret(id: string): Promise<WebhookSubscriptionWithSecret>;
}
