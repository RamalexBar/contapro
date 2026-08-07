import { randomBytes } from "node:crypto";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IWebhookSubscriptionRepository, WebhookSubscriptionRecord } from "../../domain/webhook-subscription.repository";
import { WEBHOOK_EVENT_TYPES } from "../../domain/webhook-event-types";

export interface CreateWebhookSubscriptionInput {
  url: string;
  eventTypes: string[];
}

/** Devuelto SOLO por este caso de uso -- el secreto nunca se vuelve a poder recuperar despues
 * de esta respuesta (mismo criterio que la API key en texto plano). */
export interface CreateWebhookSubscriptionResult extends WebhookSubscriptionRecord {
  secret: string;
}

export class CreateWebhookSubscriptionUseCase {
  constructor(private readonly repo: IWebhookSubscriptionRepository, private readonly audit: AuditService) {}

  async execute(input: CreateWebhookSubscriptionInput): Promise<CreateWebhookSubscriptionResult> {
    if (input.eventTypes.length === 0) {
      throw new ValidationError("La suscripcion debe tener al menos un tipo de evento");
    }
    const invalid = input.eventTypes.filter((e) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(e));
    if (invalid.length > 0) {
      throw new ValidationError(`Tipo(s) de evento no soportado(s): ${invalid.join(", ")}`);
    }

    const secret = randomBytes(32).toString("hex");
    const subscription = await this.repo.create({ url: input.url, eventTypes: input.eventTypes, secret });

    await this.audit.record({
      action: "WEBHOOK_SUBSCRIPTION_CREATED",
      entityType: "WebhookSubscription",
      entityId: subscription.id,
      description: `Suscripcion de webhook creada: ${subscription.url} (${subscription.eventTypes.join(", ")})`,
    });

    return { ...subscription, secret };
  }
}
