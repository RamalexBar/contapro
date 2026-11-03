import { env } from "../../../config/env";
import type { ContactMessageRecord, IContactNotifier } from "../domain/contact-message.repository";

/**
 * Correo al equipo de Contapro (INTERNAL_NOTIFICATIONS_EMAIL, el mismo de los avisos de pagos y fallas) por cada
 * mensaje del formulario. «Responder» le contesta directo a la persona (reply_to). Sin las variables no envia nada:
 * el mensaje igual queda en el panel de plataforma.
 */
export class ResendContactNotifier implements IContactNotifier {
  async notifyNewMessage(m: ContactMessageRecord): Promise<void> {
    if (!env.INTERNAL_NOTIFICATIONS_EMAIL || !env.RESEND_API_KEY) return;
    const lines = [
      `Nombre: ${m.name}`,
      m.company ? `Negocio: ${m.company}` : null,
      m.email ? `Correo: ${m.email}` : null,
      m.phone ? `Celular: ${m.phone}` : null,
      "",
      m.message,
      "",
      m.email ? "Responda este correo para contestarle directamente." : "No dejó correo: contéstele por WhatsApp o llamada.",
      "También queda en el panel de plataforma → Mensajes.",
    ].filter((l) => l !== null);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: env.INTERNAL_NOTIFICATIONS_EMAIL,
        ...(m.email ? { reply_to: m.email } : {}),
        subject: `[Contapro] Nuevo mensaje de ${m.name}${m.company ? ` (${m.company})` : ""}`,
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) throw new Error(`Resend respondio ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
