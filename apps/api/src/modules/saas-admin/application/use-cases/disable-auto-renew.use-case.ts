import type { AuditService } from "../../../audit/application/audit.service";
import type { ISubscriptionRepository, SubscriptionRecord } from "../../domain/subscription.repository";

/**
 * "Cancelar" la renovacion automatica: RunSubscriptionAutoChargesUseCase deja de intentar cobros
 * futuros para esta suscripcion. No cancela la suscripcion en si (status/currentPeriodEnd no se
 * tocan) -- sigue vigente hasta que venza normalmente, y de ahi en adelante el recordatorio por
 * correo/pago manual (flujo original) vuelve a ser el unico camino, igual que antes de activar
 * autoRenew.
 */
export class DisableAutoRenewUseCase {
  constructor(private readonly repo: ISubscriptionRepository, private readonly audit: AuditService) {}

  async execute(subscriptionId: string): Promise<SubscriptionRecord> {
    const subscription = await this.repo.findByIdOrThrow(subscriptionId);
    const updated = await this.repo.disableAutoRenew(subscriptionId);

    await this.audit.recordWithoutContext(subscription.companyId, null, {
      action: "SUBSCRIPTION_AUTO_RENEW_DISABLED",
      entityType: "Subscription",
      entityId: subscriptionId,
      description: "Renovacion automatica desactivada",
    });

    return updated;
  }
}
