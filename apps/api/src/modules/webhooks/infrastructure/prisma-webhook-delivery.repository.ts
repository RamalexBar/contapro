import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { IWebhookDeliveryRepository, RecordDeliveryData, WebhookDeliveryRecord } from "../domain/webhook-delivery.repository";

type Row = {
  id: string;
  webhookSubscriptionId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  responseStatus: number | null;
  success: boolean;
  errorMessage: string | null;
  attemptedAt: Date;
};

function toRecord(row: Row): WebhookDeliveryRecord {
  return {
    id: row.id,
    webhookSubscriptionId: row.webhookSubscriptionId,
    eventType: row.eventType,
    payload: row.payload,
    responseStatus: row.responseStatus,
    success: row.success,
    errorMessage: row.errorMessage,
    attemptedAt: row.attemptedAt,
  };
}

export class PrismaWebhookDeliveryRepository implements IWebhookDeliveryRepository {
  async record(data: RecordDeliveryData): Promise<WebhookDeliveryRecord> {
    const row = await prisma.webhookDelivery.create({
      data: {
        webhookSubscriptionId: data.webhookSubscriptionId,
        eventType: data.eventType,
        payload: data.payload as Prisma.InputJsonValue,
        responseStatus: data.responseStatus,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });
    return toRecord(row);
  }

  async list(webhookSubscriptionId: string): Promise<WebhookDeliveryRecord[]> {
    // WebhookDelivery no tiene companyId propio (fila hija, ver domain) -- se filtra via su
    // WebhookSubscription padre desde el principio (leccion del item 39: DepreciationEntry
    // necesito este mismo filtro agregado despues; aqui va desde el arranque).
    const companyId = getTenantContext().companyId;
    const rows = await prisma.webhookDelivery.findMany({
      where: { webhookSubscriptionId, webhookSubscription: { companyId } },
      orderBy: { attemptedAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<WebhookDeliveryRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.webhookDelivery.findFirst({ where: { id, webhookSubscription: { companyId } } });
    if (!row) throw new NotFoundError("WebhookDelivery", id);
    return toRecord(row);
  }
}
