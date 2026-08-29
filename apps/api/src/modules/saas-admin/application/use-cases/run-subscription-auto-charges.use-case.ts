import crypto from "node:crypto";
import type { AuditService } from "../../../audit/application/audit.service";
import { AUTO_CHARGE_METHOD, type ISubscriptionRepository } from "../../domain/subscription.repository";
import type { IPaymentGateway } from "../../domain/payment-gateway";

/**
 * Poller de renovacion automatica (ver startSubscriptionAutoChargePoller): por cada suscripcion
 * con autoRenew activo y currentPeriodEnd ya vencido, intenta cobrar la payment_source guardada
 * SIN redireccion ni presencia del cliente. El resultado sincrono de Wompi (`chargePaymentSource`)
 * casi siempre es PENDING -- no se confirma aca: el webhook "transaction.updated" (mismo que ya
 * procesa el checkout manual) confirma o falla el pago via ConfirmWompiPaymentUseCase, cero
 * cambios ahi. Si la llamada a Wompi falla SINCRONICAMENTE (red, tarjeta invalida de una), el pago
 * PENDING que se acaba de crear se marca FAILED de una vez -- nunca llegaria un webhook para el.
 *
 * `hasAutoChargeAttemptSince` evita reintentar el mismo dia (el poller corre cada hora, un DECLINED
 * no se arregla solo en una hora) -- un intento fallido espera al proximo tick DEL DIA SIGUIENTE.
 */
export class RunSubscriptionAutoChargesUseCase {
  constructor(
    private readonly repo: ISubscriptionRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly audit: AuditService
  ) {}

  async execute(): Promise<void> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = await this.repo.listDueForAutoCharge(now);

    for (const subscription of due) {
      if (!subscription.wompiPaymentSourceId) continue;

      const alreadyAttemptedToday = await this.repo.hasAutoChargeAttemptSince(subscription.id, startOfToday);
      if (alreadyAttemptedToday) continue;

      const amount = subscription.billingCycle === "YEARLY" ? subscription.planPriceYearly : subscription.planPriceMonthly;
      if (amount <= 0) continue;

      const reference = `sub-auto-${subscription.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      await this.repo.createPendingPayment({
        subscriptionId: subscription.id,
        amount,
        method: AUTO_CHARGE_METHOD,
        reference,
      });

      try {
        await this.paymentGateway.chargePaymentSource({
          reference,
          amountInCents: Math.round(amount * 100),
          customerEmail: subscription.companyEmail,
          paymentSourceId: subscription.wompiPaymentSourceId,
        });
      } catch (err) {
        const pending = await this.repo.findPaymentByReference(reference);
        if (pending) await this.repo.failPayment(pending.id);

        await this.audit.recordWithoutContext(subscription.companyId, null, {
          action: "SUBSCRIPTION_AUTO_CHARGE_FAILED",
          entityType: "Subscription",
          entityId: subscription.id,
          description: `Cobro automatico fallo: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }
}
