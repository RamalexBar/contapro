export interface WhatsAppDocumentPayload {
  buffer: Buffer;
  filename: string;
  caption?: string;
}

/**
 * Puerto generico de envio por WhatsApp -- implementado por WhatsAppCloudApiSender (Meta Graph
 * API). Los casos de uso de dominio (envio de RIDE, envio de desprendible, recordatorios) viven
 * en sus modulos dueños e importan este puerto desde whatsapp.container.ts, nunca al reves.
 */
export interface IWhatsAppSender {
  sendText(toPhoneE164: string, message: string): Promise<void>;
  sendDocument(toPhoneE164: string, doc: WhatsAppDocumentPayload): Promise<void>;
}
