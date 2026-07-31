import { calculateGraceEndsAt } from "@erp/shared-utils";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ISubscriptionRepository } from "../../domain/subscription.repository";

const REMINDER_DAYS = [8, 5, 3, 1, 0];

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * Recorre TRIALING/ACTIVE/GRACE_PERIOD diariamente (ver poller): genera recordatorios en
 * 8/5/3/1/0 dias antes del vencimiento (SOLO el registro -- no hay proveedor de email/WhatsApp
 * integrado en el codebase todavia, ver README), pasa a GRACE_PERIOD lo vencido y a SUSPENDED
 * lo que supero el periodo de gracia (calculateGraceEndsAt, packages/shared-utils/src/dates.ts).
 */
export class RunSubscriptionLifecycleUseCase {
  constructor(private readonly repo: ISubscriptionRepository, private readonly audit: AuditService) {}

  async execute(): Promise<void> {
    const subscriptions = await this.repo.listForLifecycleCheck();
    const now = new Date();

    for (const subscription of subscriptions) {
      const daysUntilDue = daysBetween(now, subscription.currentPeriodEnd);

      if (REMINDER_DAYS.includes(daysUntilDue)) {
        const alreadySent = await this.repo.hasReminderLog(subscription.id, daysUntilDue);
        if (!alreadySent) {
          await this.repo.createReminderLog(subscription.id, daysUntilDue, "EMAIL");
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
