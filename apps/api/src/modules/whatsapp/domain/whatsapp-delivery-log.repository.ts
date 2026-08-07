export type WhatsAppMessageType = "SALE_INVOICE_RIDE" | "PAYSLIP" | "SUBSCRIPTION_REMINDER" | "COLLECTION_REMINDER";

export interface WhatsAppDeliveryLogRecord {
  id: string;
  companyId: string;
  messageType: WhatsAppMessageType;
  referenceId: string;
  recipientPhone: string;
  success: boolean;
  errorMessage: string | null;
  sentAt: Date;
}

export interface RecordWhatsAppDeliveryData {
  companyId: string;
  messageType: WhatsAppMessageType;
  referenceId: string;
  recipientPhone: string;
  success: boolean;
  errorMessage?: string | null;
}

/**
 * A diferencia de la mayoria de repos de este backend, TODOS los metodos reciben `companyId`
 * explicito como parametro (nunca via getTenantContext() ni la extension automatica de tenant) --
 * ver el comentario en tenant.extension.ts. Este modelo se escribe tanto desde casos de uso
 * tenant-scoped (factura, nomina, cobranza) como desde el poller de recordatorios de suscripcion,
 * que es platform-level y nunca corre dentro de un AsyncLocalStorage de tenant.
 */
export interface IWhatsAppDeliveryLogRepository {
  record(data: RecordWhatsAppDeliveryData): Promise<WhatsAppDeliveryLogRecord>;
  list(filter: { companyId: string; messageType: WhatsAppMessageType; referenceId: string }): Promise<WhatsAppDeliveryLogRecord[]>;
  findByIdOrThrow(id: string, companyId: string): Promise<WhatsAppDeliveryLogRecord>;
}
