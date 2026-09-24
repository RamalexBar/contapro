import { env } from "../../../config/env";
import { ValidationError } from "../../../shared/errors/app-error";
import type {
  FactusActivationAttachment,
  FactusActivationRequestInput,
  IFactusActivationNotifier,
} from "../domain/factus-activation-notifier";

/** Confirmado por Factus por escrito el 2026-09-24 -- correo al que hay que mandar los 5
 * documentos de activacion de cada NIT (RUT, certificado de representacion legal, cedula,
 * comprobante de compra, logo). No es una credencial, es un dato de negocio fijo -- no amerita
 * variable de entorno (mismo criterio que CERTIFICATE_PRICE en LandingPage.tsx). */
const FACTUS_ACTIVATION_EMAIL = "activacion@factus.com.co";

/**
 * Mismo patron que ResendEmailNotifier (fetch directo, sin SDK) -- unica diferencia es el campo
 * `attachments` de la API de Resend (https://resend.com/docs/api-reference/emails/send-email),
 * que espera el contenido en base64 tal cual, sin el prefijo "data:...;base64,". NO PROBADO
 * end-to-end contra el servicio real (mismo estado que el resto de la integracion Resend, ver
 * README de saas-admin): sin RESEND_API_KEY configurado, `send` lanza con mensaje claro.
 */
export class ResendFactusActivationNotifier implements IFactusActivationNotifier {
  async send(input: FactusActivationRequestInput): Promise<void> {
    if (!env.RESEND_API_KEY) {
      throw new ValidationError("RESEND_API_KEY no esta configurado");
    }

    const attachments = [
      toResendAttachment(input.rut, "RUT"),
      input.legalRepCertificate ? toResendAttachment(input.legalRepCertificate, "certificado-representacion-legal") : null,
      toResendAttachment(input.legalRepId, "cedula-representante-legal"),
      toResendAttachment(input.purchaseProof, "comprobante-compra"),
      toResendAttachment(input.logo, "logo"),
    ].filter((a): a is { filename: string; content: string } => a !== null);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: FACTUS_ACTIVATION_EMAIL,
        subject: `Activacion NIT ${input.nit} - ${input.companyName}`,
        html: buildHtml(input),
        attachments,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondio ${res.status}: ${body}`);
    }
  }
}

function toResendAttachment(attachment: FactusActivationAttachment, fallbackName: string): { filename: string; content: string } {
  return { filename: attachment.filename || withExtension(fallbackName, attachment.mediaType), content: attachment.base64 };
}

function withExtension(name: string, mediaType: FactusActivationAttachment["mediaType"]): string {
  const ext = mediaType === "application/pdf" ? "pdf" : mediaType === "image/png" ? "png" : "jpg";
  return `${name}.${ext}`;
}

function buildHtml(input: FactusActivationRequestInput): string {
  return `
    <p>Solicitud de activacion de NIT para facturacion electronica.</p>
    <ul>
      <li><strong>Empresa:</strong> ${escapeHtml(input.companyName)}</li>
      <li><strong>NIT:</strong> ${escapeHtml(input.nit)}</li>
      <li><strong>Version de integracion:</strong> ${escapeHtml(input.integrationVersion)}</li>
      <li><strong>Persona natural (sin certificado de representacion legal):</strong> ${input.legalRepCertificate ? "No" : "Si"}</li>
    </ul>
    <p>Documentos adjuntos: RUT, ${input.legalRepCertificate ? "certificado de representacion legal, " : ""}cedula del representante legal, comprobante de compra, logo.</p>
  `.trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
