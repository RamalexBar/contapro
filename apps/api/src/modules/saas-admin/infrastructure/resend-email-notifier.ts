import { env } from "../../../config/env";
import type { IReminderNotifier, SubscriptionReminderNotification } from "../domain/reminder-notifier";

/**
 * Integracion real con Resend (https://resend.com/docs/api-reference/emails/send-email) via
 * fetch directo -- sin SDK, mismo criterio que dian-soap-client.ts (menos capas para inspeccionar/
 * ajustar). NO PROBADO end-to-end contra el servicio real: sin RESEND_API_KEY configurado (vacio
 * por defecto, ver config/env.ts) `send` lanza y el recordatorio queda pendiente para el
 * siguiente ciclo del poller (ver IReminderNotifier). El formato del payload y el codigo de
 * respuesta si siguen la documentacion publica de Resend al momento de escribir esto.
 */
export class ResendEmailNotifier implements IReminderNotifier {
  async send(notification: SubscriptionReminderNotification): Promise<void> {
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
        to: notification.companyEmail,
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

function buildSubject(n: SubscriptionReminderNotification): string {
  if (n.daysBeforeDue === 0) return "Tu suscripcion vence hoy";
  return `Tu suscripcion vence en ${n.daysBeforeDue} dia${n.daysBeforeDue === 1 ? "" : "s"}`;
}

function buildHtml(n: SubscriptionReminderNotification): string {
  const dueDate = n.currentPeriodEnd.toISOString().slice(0, 10);
  const urgency = n.daysBeforeDue === 0 ? "vence <strong>hoy</strong>" : `vence el <strong>${dueDate}</strong>`;
  return `
    <p>Hola ${escapeHtml(n.companyName)},</p>
    <p>Tu plan <strong>${escapeHtml(n.planName)}</strong> ${urgency}.</p>
    <p>Para evitar interrupciones en el servicio, renueva tu suscripcion antes de esa fecha.</p>
    <p>Si ya realizaste el pago, puedes ignorar este mensaje.</p>
  `.trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
