import { calculateGraceEndsAt } from "@erp/shared-utils";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IReminderNotifier } from "../../domain/reminder-notifier";
import type { ISubscriptionRepository } from "../../domain/subscription.repository";

const REMINDER_DAYS = [8, 5, 3, 1, 0];
const REMINDER_CHANNEL = "EMAIL";

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * Recorre TRIALING/ACTIVE/GRACE_PERIOD diariamente (ver poller): envia recordatorios en
 * 8/5/3/1/0 dias antes del vencimiento via IReminderNotifier (ResendEmailNotifier por defecto,
 * ver saas-admin.container.ts), pasa a GRACE_PERIOD lo vencido y a SUSPENDED lo que supero el
 * periodo de gracia (calculateGraceEndsAt, packages/shared-utils/src/dates.ts).
 *
 * El SubscriptionReminderLog SOLO se crea si el envio tuvo exito -- `sentAt` debe significar
 * "se envio", no "se debia enviar" -- asi que un fallo del proveedor de correo (o
 * RESEND_API_KEY sin configurar) deja el recordatorio pendiente para reintentar en el siguiente
 * ciclo del poller, en vez de perderse silenciosamente. Mismo criterio de reintento que
 * PollDianSubmissionsUseCase.
 */
export class RunSubscriptionLifecycleUseCase {
  constructor(
    private readonly repo: ISubscriptionRepository,
    private readonly notifier: IReminderNotifier,
    private readonly audit: AuditService
  ) {}

  async execute(): Promise<void> {
    const subscriptions = await this.repo.listForLifecycleCheck();
    const now = new Date();

    for (const subscription of subscriptions) {
      const daysUntilDue = daysBetween(now, subscription.currentPeriodEnd);

      if (REMINDER_DAYS.includes(daysUntilDue)) {
        const alreadySent = await this.repo.hasReminderLog(subscription.id, daysUntilDue);
        if (!alreadySent) {
          try {
            await this.notifier.send({
              companyName: subscription.companyName,
              companyEmail: subscription.companyEmail,
              planName: subscription.planName,
              daysBeforeDue: daysUntilDue,
              currentPeriodEnd: subscription.currentPeriodEnd,
            });
            await this.repo.createReminderLog(subscription.id, daysUntilDue, REMINDER_CHANNEL);
            await this.audit.recordWithoutContext(subscription.companyId, null, {
              action: "SUBSCRIPTION_REMINDER_SENT",
              entityType: "Subscription",
              entityId: subscription.id,
              description: `Recordatorio de vencimiento enviado (${daysUntilDue} dias antes) a ${subscription.companyEmail}`,
            });
          } catch (err) {
            await this.audit.recordWithoutContext(subscription.companyId, null, {
              action: "SUBSCRIPTION_REMINDER_FAILED",
              entityType: "Subscription",
              entityId: subscription.id,
              description: `No se pudo enviar el recordatorio de vencimiento (${daysUntilDue} dias antes): ${(err as Error).message}`,
            });
          }
        }
      }

      if (daysUntilDue < 0) {
        if (subscription.status === "TRIALING" || subscription.status === "ACTIVE") {
          const graceEndsAt = calculateGraceEndsAt(subscription.currentPeriodEnd);
          await this.repo.updateStatus(subscription.id, "GRACE_PERIOD", graceEndsAt);
          await this.audit.recordWithoutContext(subscription.companyId, null, {
            action: "SUBSCRIPTION_STATUS_CHANGED",
            entityType: "Subscription",
            entityId: subscription.id,
            description: `Suscripcion vencida, entra en periodo de gracia hasta ${graceEndsAt.toISOString().slice(0, 10)}`,
          });
        } else if (subscription.status === "GRACE_PERIOD" && subscription.graceEndsAt && now > subscription.graceEndsAt) {
          await this.repo.updateStatus(subscription.id, "SUSPENDED");
          await this.audit.recordWithoutContext(subscription.companyId, null, {
            action: "SUBSCRIPTION_STATUS_CHANGED",
            entityType: "Subscription",
            entityId: subscription.id,
            description: "Periodo de gracia agotado, suscripcion suspendida (sin borrar informacion)",
          });
        }
      }
    }
  }
}
