import { env } from "../../../config/env";
import type { IPasswordResetNotifier, PasswordResetNotification } from "../domain/password-reset-notifier";

/**
 * Integracion con Resend via fetch directo (sin SDK), mismo criterio que resend-email-notifier.ts
 * (saas-admin) y resend-collection-reminder-notifier.ts (collections). NO PROBADO end-to-end
 * contra el servicio real: sin RESEND_API_KEY configurado `send` lanza (ver
 * RequestPasswordResetUseCase, que atrapa el error para no filtrar por respuesta si el correo
 * existe o no).
 */
export class ResendPasswordResetNotifier implements IPasswordResetNotifier {
  async send(notification: PasswordResetNotification): Promise<void> {
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
        to: notification.email,
        subject: "Recupera tu contraseña de Contapro",
        html: buildHtml(notification),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondio ${res.status}: ${body}`);
    }
  }
}

function buildHtml(n: PasswordResetNotification): string {
  return `
    <p>Hola ${escapeHtml(n.fullName)},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña en Contapro.</p>
    <p><a href="${n.resetUrl}">Haz clic aquí para elegir una nueva contraseña</a></p>
    <p>Este enlace vence en 1 hora. Si no solicitaste esto, puedes ignorar este correo.</p>
  `.trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
