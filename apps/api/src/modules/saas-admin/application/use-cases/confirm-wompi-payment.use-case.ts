import { calculateNextPeriodEnd } from "@erp/shared-utils";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPaymentGateway, WompiWebhookEvent } from "../../domain/payment-gateway";
import type { ISubscriptionRepository } from "../../domain/subscription.repository";
import type { IPaymentNotificationInfoReader, IPlatformNotifier } from "../../domain/platform-notifier";

const APPROVED_STATUS = "APPROVED";
const FAILED_STATUSES = new Set(["DECLINED", "ERROR", "VOIDED"]);

/**
 * Procesa el webhook "transaction.updated" de Wompi. Verifica la firma ANTES de tocar cualquier
 * dato -- si no verifica, se ignora el evento sin lanzar (Wompi reintenta webhooks fallidos por
 * su cuenta; devolver 2xx igual evita que un tercero mandando basura a esta URL genere ruido de
 * reintentos infinitos del lado de Wompi real). Busca el SubscriptionPayment PENDING por
 * `reference` (unico por intento de cobro, ver CreateSubscriptionCheckoutUseCase):
 * - APPROVED: aplica el pago (mismo calculo de vencimiento que RegisterSubscriptionPaymentUseCase
 *   -- calculateNextPeriodEnd desde currentPeriodEnd ORIGINAL, no desde la fecha del pago, para
 *   no regalar dias por pagar tarde dentro del periodo de gracia).
 * - DECLINED/ERROR/VOIDED: marca el pago como FAILED, no toca la suscripcion (el poller de
 *   recordatorios/vencimientos sigue su curso normal).
 * - PENDING (o cualquier otro estado): no-op, se espera el proximo evento.
 */
export class ConfirmWompiPaymentUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly audit: AuditService,
    private readonly notifications?: { reader: IPaymentNotificationInfoReader; notifier: IPlatformNotifier }
  ) {}

  async execute(event: WompiWebhookEvent): Promise<void> {
    if (event.event !== "transaction.updated") return;
    if (!this.paymentGateway.verifyWebhookSignature(event)) return;

    const { reference, status } = event.data.transaction;
    const payment = await this.subscriptionRepo.findPaymentByReference(reference);
    if (!payment || payment.status !== "PENDING") return;

    if (status === APPROVED_STATUS) {
      const subscription = await this.subscriptionRepo.findByIdOrThrow(payment.subscriptionId);
      const cycleMonths = subscription.billingCycle === "YEARLY" ? 12 : 1;
      const newPeriodEnd = calculateNextPeriodEnd(subscription.currentPeriodEnd, cycleMonths);

      await this.subscriptionRepo.confirmPayment(payment.id, newPeriodEnd);

      await this.audit.recordWithoutContext(subscription.companyId, null, {
        action: "SUBSCRIPTION_PAYMENT_REGISTERED",
        entityType: "Subscription",
        entityId: subscription.id,
        description: `Pago Wompi confirmado: ${payment.amount}. Nuevo vencimiento: ${newPeriodEnd.toISOString().slice(0, 10)}`,
        metadata: { reference, wompiTransactionId: event.data.transaction.id },
      });
      await this.notifyTeam(subscription.id, Number(payment.amount), newPeriodEnd);
    } else if (FAILED_STATUSES.has(status)) {
      await this.subscriptionRepo.failPayment(payment.id);
    }
  }

  /** Aviso al equipo de Contapro; si falla, el pago ya quedo aplicado y no se revierte nada. */
  private async notifyTeam(subscriptionId: string, amount: number, newPeriodEnd: Date): Promise<void> {
    if (!this.notifications) return;
    try {
      const info = await this.notifications.reader.findPaymentNotificationInfo(subscriptionId);
      if (!info) return;
      await this.notifications.notifier.paymentApproved({
        ...info,
        amount,
        newPeriodEnd,
        invoicingPending: info.electronicInvoicingProvider !== "FACTUS",
      });
    } catch (err) {
      console.error("No se pudo enviar el aviso de pago al equipo:", err);
    }
  }
}
