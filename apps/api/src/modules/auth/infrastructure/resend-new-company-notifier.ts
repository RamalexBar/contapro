import { env } from "../../../config/env";
import type { INewCompanyNotifier, NewCompanyNotification } from "../domain/new-company-notifier";

/**
 * Mismo patron que ResendPasswordResetNotifier (fetch directo, sin SDK) -- **verificado en vivo
 * contra Resend real el 2026-09-25** (a diferencia del resto de integraciones Resend de este
 * codebase, todas documentadas como "sin probar"): se disparo un correo de reseteo de contraseña
 * de prueba y llego a la bandeja real.
 *
 * A diferencia de los demas notifiers de este modulo, esto es una comodidad OPCIONAL (nadie
 * depende de que el aviso llegue para que el registro de la empresa funcione) -- si
 * INTERNAL_NOTIFICATIONS_EMAIL no esta configurado, `send` no hace nada en vez de lanzar.
 */
export class ResendNewCompanyNotifier implements INewCompanyNotifier {
  async send(notification: NewCompanyNotification): Promise<void> {
    if (!env.INTERNAL_NOTIFICATIONS_EMAIL) return;
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
        to: env.INTERNAL_NOTIFICATIONS_EMAIL,
        subject: `Nueva empresa registrada: ${notification.companyName}`,
        html: buildHtml(notification),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondio ${res.status}: ${body}`);
    }
  }
}

function buildHtml(n: NewCompanyNotification): string {
  return `
    <p>Se registro una empresa nueva en Contapro.</p>
    <ul>
      <li><strong>Empresa:</strong> ${escapeHtml(n.companyName)}</li>
      <li><strong>NIT:</strong> ${escapeHtml(n.nit)}</li>
      <li><strong>Correo de la empresa:</strong> ${escapeHtml(n.companyEmail)}</li>
      <li><strong>Administrador:</strong> ${escapeHtml(n.adminFullName)} (${escapeHtml(n.adminEmail)})</li>
    </ul>
  `.trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
