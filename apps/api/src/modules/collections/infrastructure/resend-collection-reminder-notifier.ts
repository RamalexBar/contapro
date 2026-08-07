import { env } from "../../../config/env";
import { formatCOP } from "@erp/shared-utils";
import type { CollectionReminderNotification, ICollectionReminderNotifier } from "../domain/collection-reminder-notifier";

/**
 * Integracion con Resend via fetch directo (sin SDK), mismo criterio que
 * resend-email-notifier.ts (saas-admin) y dian-soap-client.ts. NO PROBADO end-to-end contra el
 * servicio real: sin RESEND_API_KEY configurado `send` lanza y el recordatorio queda pendiente
 * para el siguiente ciclo del poller.
 */
export class ResendCollectionReminderNotifier implements ICollectionReminderNotifier {
  async send(notification: CollectionReminderNotification): Promise<void> {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY no esta configurado");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: notification.customerEmail,
        subject: buildSubject(notification),
        html: buildHtml(notification),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondio ${res.status}: ${body}`);
    }
  }
}

function buildSubject(n: CollectionReminderNotification): string {
  if (n.daysBeforeDue > 0) return `Recordatorio: factura #${n.saleNumber} vence en ${n.daysBeforeDue} dia${n.daysBeforeDue === 1 ? "" : "s"}`;
  if (n.daysBeforeDue === 0) return `Tu factura #${n.saleNumber} vence hoy`;
  return `Factura #${n.saleNumber} vencida hace ${Math.abs(n.daysBeforeDue)} dia${Math.abs(n.daysBeforeDue) === 1 ? "" : "s"}`;
}

function buildHtml(n: CollectionReminderNotification): string {
  const dueDate = n.dueDate.toISOString().slice(0, 10);
  const urgency =
    n.daysBeforeDue > 0
      ? `vence el <strong>${dueDate}</strong>`
      : n.daysBeforeDue === 0
        ? "vence <strong>hoy</strong>"
        : `vencio el <strong>${dueDate}</strong> y sigue pendiente`;
  return `
    <p>Hola ${escapeHtml(n.customerName)},</p>
    <p>Tu factura <strong>#${n.saleNumber}</strong> por <strong>${escapeHtml(formatCOP(n.amountDue))}</strong> ${urgency}.</p>
    <p>Si ya realizaste el pago, puedes ignorar este mensaje.</p>
  `.trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
