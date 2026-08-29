import type { AuditService } from "../../../audit/application/audit.service";
import type { IPaymentGateway } from "../../domain/payment-gateway";
import type { ISubscriptionRepository, SubscriptionRecord } from "../../domain/subscription.repository";

export interface SavePaymentSourceInput {
  subscriptionId: string;
  cardToken: string;
  customerEmail: string;
  acceptanceToken: string;
}

/**
 * Guarda la tarjeta del cliente en Wompi (payment_source) y activa autoRenew -- desde este punto
 * RunSubscriptionAutoChargesUseCase cobra solo cada vencimiento hasta que el usuario desactive la
 * renovacion automatica (DisableAutoRenewUseCase). `cardToken` viene de que el FRONTEND tokenizo la
 * tarjeta directo contra Wompi (POST /tokens/cards con la llave publica) -- este backend nunca ve
 * el numero de tarjeta, solo ese token de un solo uso.
 */
export class SavePaymentSourceUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly audit: AuditService
  ) {}

  async execute(input: SavePaymentSourceInput): Promise<SubscriptionRecord> {
    const subscription = await this.subscriptionRepo.findByIdOrThrow(input.subscriptionId);

    const source = await this.paymentGateway.createPaymentSource({
      cardToken: input.cardToken,
      customerEmail: input.customerEmail,
      acceptanceToken: input.acceptanceToken,
    });

    const updated = await this.subscriptionRepo.savePaymentSource(subscription.id, {
      wompiPaymentSourceId: source.paymentSourceId,
      cardLastFour: source.cardLastFour,
      cardBrand: source.cardBrand,
    });

    await this.audit.recordWithoutContext(subscription.companyId, null, {
      action: "SUBSCRIPTION_AUTO_RENEW_ENABLED",
      entityType: "Subscription",
      entityId: subscription.id,
      description: `Renovacion automatica activada${source.cardBrand ? ` (${source.cardBrand} terminada en ${source.cardLastFour})` : ""}`,
    });

    return updated;
  }
}
