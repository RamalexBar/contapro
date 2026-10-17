import { formatCOP } from "@erp/shared-utils";
import { env } from "../../../config/env";
import type { IPlatformNotifier, PaymentApprovedNotification } from "../domain/platform-notifier";

/**
 * Correo al equipo de Contapro (INTERNAL_NOTIFICATIONS_EMAIL) cada vez que Wompi confirma un pago, con
 * el recordatorio de activar la facturacion electronica si la empresa todavia no la tiene. Mismo
 * envio por fetch a Resend que resend-email-notifier.ts. Sin INTERNAL_NOTIFICATIONS_EMAIL o sin
 * RESEND_API_KEY no envia nada.
 */
export class ResendPlatformNotifier implements IPlatformNotifier {
  async paymentApproved(n: PaymentApprovedNotification): Promise<void> {
    if (!env.INTERNAL_NOTIFICATIONS_EMAIL || !env.RESEND_API_KEY) return;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: env.INTERNAL_NOTIFICATIONS_EMAIL,
        subject: `Nuevo pago: ${n.companyName} (${n.planName})${n.invoicingPending ? " — activar facturación" : ""}`,
        html: buildHtml(n),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondio ${res.status}: ${body}`);
    }
  }
}

export function buildHtml(n: PaymentApprovedNotification): string {
  const cycle = n.billingCycle === "YEARLY" ? "anual" : "mensual";
  const pending = n.invoicingPending
    ? `<p><strong>Pendiente: activar la facturación electrónica con Factus.</strong> Pídele al cliente su RUT,
       el certificado de existencia y representación legal (si es empresa), la cédula del representante
       legal y el logo. Después envíalos desde el panel de plataforma: Empresas → Solicitar activación Factus.</p>`
    : `<p>Esta empresa ya factura con Factus: no hay nada que activar.</p>`;
  return `
    <p><strong>${escapeHtml(n.companyName)}</strong> (NIT ${escapeHtml(n.nit)}) pagó el plan
    <strong>${escapeHtml(n.planName)}</strong> ${cycle}: <strong>${formatCOP(n.amount)}</strong>.</p>
    <p>Queda activo hasta el ${n.newPeriodEnd.toISOString().slice(0, 10)}. Correo de la empresa: ${escapeHtml(n.companyEmail)}.</p>
    ${pending}
  `.trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
