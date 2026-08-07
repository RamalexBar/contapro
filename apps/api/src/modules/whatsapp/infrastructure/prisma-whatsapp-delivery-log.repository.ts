import { basePrisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  IWhatsAppDeliveryLogRepository,
  RecordWhatsAppDeliveryData,
  WhatsAppDeliveryLogRecord,
  WhatsAppMessageType,
} from "../domain/whatsapp-delivery-log.repository";

function toRecord(row: {
  id: string;
  companyId: string;
  messageType: string;
  referenceId: string;
  recipientPhone: string;
  success: boolean;
  errorMessage: string | null;
  sentAt: Date;
}): WhatsAppDeliveryLogRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    messageType: row.messageType as WhatsAppMessageType,
    referenceId: row.referenceId,
    recipientPhone: row.recipientPhone,
    success: row.success,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt,
  };
}

/**
 * WhatsAppDeliveryLog NO esta en TENANT_MODELS (ver tenant.extension.ts) -- usa basePrisma
 * (sin la extension automatica) y recibe companyId explicito en cada metodo, porque se escribe
 * tanto desde contexto tenant-scoped como desde el poller platform-level de recordatorios de
 * suscripcion.
 */
export class PrismaWhatsAppDeliveryLogRepository implements IWhatsAppDeliveryLogRepository {
  async record(data: RecordWhatsAppDeliveryData): Promise<WhatsAppDeliveryLogRecord> {
    const row = await basePrisma.whatsAppDeliveryLog.create({
      data: {
        companyId: data.companyId,
        messageType: data.messageType,
        referenceId: data.referenceId,
        recipientPhone: data.recipientPhone,
        success: data.success,
        errorMessage: data.errorMessage ?? null,
      },
    });
    return toRecord(row);
  }

  async list(filter: { companyId: string; messageType: WhatsAppMessageType; referenceId: string }): Promise<WhatsAppDeliveryLogRecord[]> {
    const rows = await basePrisma.whatsAppDeliveryLog.findMany({
      where: { companyId: filter.companyId, messageType: filter.messageType, referenceId: filter.referenceId },
      orderBy: { sentAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<WhatsAppDeliveryLogRecord> {
    const row = await basePrisma.whatsAppDeliveryLog.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("WhatsAppDeliveryLog", id);
    return toRecord(row);
  }
}
