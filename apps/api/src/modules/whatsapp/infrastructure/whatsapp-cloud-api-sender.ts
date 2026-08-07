import { env } from "../../../config/env";
import type { IWhatsAppSender, WhatsAppDocumentPayload } from "../domain/whatsapp-sender.port";

/**
 * Integracion real con la WhatsApp Business Cloud API de Meta
 * (https://developers.facebook.com/docs/whatsapp/cloud-api) via fetch directo -- sin SDK, mismo
 * criterio que dian-soap-client.ts/resend-email-notifier.ts (menos capas para inspeccionar/
 * ajustar). NO PROBADO contra el servicio real de Meta: exige verificacion de negocio y, para
 * mensajes iniciados por la empresa fuera de una ventana de 24h abierta por el cliente, plantillas
 * de mensaje pre-aprobadas -- proceso externo, no completable en este entorno (ver README.md de
 * este modulo). El formato de los payloads sigue la documentacion publica de Meta al momento de
 * escribir esto, sin confirmar contra una cuenta real.
 */
export class WhatsAppCloudApiSender implements IWhatsAppSender {
  async sendText(toPhoneE164: string, message: string): Promise<void> {
    await this.postMessage({
      messaging_product: "whatsapp",
      to: toPhoneE164,
      type: "text",
      text: { body: message },
    });
  }

  async sendDocument(toPhoneE164: string, doc: WhatsAppDocumentPayload): Promise<void> {
    const mediaId = await this.uploadMedia(doc);
    await this.postMessage({
      messaging_product: "whatsapp",
      to: toPhoneE164,
      type: "document",
      document: { id: mediaId, filename: doc.filename, caption: doc.caption },
    });
  }

  private baseUrl(): string {
    this.assertConfigured();
    return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}`;
  }

  private assertConfigured(): void {
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error("WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID no estan configurados");
    }
  }

  private async uploadMedia(doc: WhatsAppDocumentPayload): Promise<string> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "application/pdf");
    form.append("file", new Blob([new Uint8Array(doc.buffer)], { type: "application/pdf" }), doc.filename);

    const res = await fetch(`${this.baseUrl()}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`WhatsApp media upload respondio ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("WhatsApp media upload no devolvio un id");
    return json.id;
  }

  private async postMessage(body: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const responseBody = await res.text().catch(() => "");
      throw new Error(`WhatsApp respondio ${res.status}: ${responseBody}`);
    }
  }
}
