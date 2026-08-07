import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateWebhookSubscriptionData,
  IWebhookSubscriptionRepository,
  WebhookSubscriptionRecord,
  WebhookSubscriptionWithSecret,
} from "../domain/webhook-subscription.repository";

type Row = { id: string; url: string; eventTypes: string[]; isActive: boolean; createdAt: Date; secret: string };

function toRecord(row: Omit<Row, "secret">): WebhookSubscriptionRecord {
  return { id: row.id, url: row.url, eventTypes: row.eventTypes, isActive: row.isActive, createdAt: row.createdAt };
}

function toRecordWithSecret(row: Row): WebhookSubscriptionWithSecret {
  return { ...toRecord(row), secret: row.secret };
}

export class PrismaWebhookSubscriptionRepository implements IWebhookSubscriptionRepository {
  async create(data: CreateWebhookSubscriptionData): Promise<WebhookSubscriptionRecord> {
    const row = await prisma.webhookSubscription.create({
      data: { companyId: getTenantContext().companyId, url: data.url, eventTypes: data.eventTypes, secret: data.secret },
    });
    return toRecord(row);
  }

  async list(): Promise<WebhookSubscriptionRecord[]> {
    const rows = await prisma.webhookSubscription.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<WebhookSubscriptionRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.webhookSubscription.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("WebhookSubscription", id);
    return toRecord(row);
  }

  async deactivate(id: string): Promise<WebhookSubscriptionRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.webhookSubscription.update({ where: { id }, data: { isActive: false } });
    return toRecord(row);
  }

  async listActiveForEvent(eventType: string): Promise<WebhookSubscriptionWithSecret[]> {
    // Critico: sin companyId aqui, un evento de una empresa se despacharia a las suscripciones
    // de TODAS las empresas que matcheen el tipo de evento (fuga cross-tenant real, no solo
    // teorica -- CreateSaleUseCase llama a esto siempre dentro de un tenantStorage.run ya
    // resuelto, tanto para requests JWT como API key).
    const companyId = getTenantContext().companyId;
    const rows = await prisma.webhookSubscription.findMany({
      where: { companyId, isActive: true, eventTypes: { has: eventType } },
    });
    return rows.map(toRecordWithSecret);
  }

  async findByIdWithSecret(id: string): Promise<WebhookSubscriptionWithSecret> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.webhookSubscription.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("WebhookSubscription", id);
    return toRecordWithSecret(row);
  }
}
