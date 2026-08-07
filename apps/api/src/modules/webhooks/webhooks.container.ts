import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaWebhookSubscriptionRepository } from "./infrastructure/prisma-webhook-subscription.repository";
import { PrismaWebhookDeliveryRepository } from "./infrastructure/prisma-webhook-delivery.repository";
import { WebhookDispatcherService } from "./application/webhook-dispatcher.service";
import { CreateWebhookSubscriptionUseCase } from "./application/use-cases/create-webhook-subscription.use-case";
import { ListWebhookSubscriptionsUseCase } from "./application/use-cases/list-webhook-subscriptions.use-case";
import { DeactivateWebhookSubscriptionUseCase } from "./application/use-cases/deactivate-webhook-subscription.use-case";
import { ListWebhookDeliveriesUseCase } from "./application/use-cases/list-webhook-deliveries.use-case";
import { ResendWebhookDeliveryUseCase } from "./application/use-cases/resend-webhook-delivery.use-case";
import { WebhooksController } from "./interfaces/webhooks.controller";

const subscriptionRepo = new PrismaWebhookSubscriptionRepository();
const deliveryRepo = new PrismaWebhookDeliveryRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

/** Usado por pos/sale/sale.container.ts para disparar el evento sale.created. */
export const webhookDispatcherService = new WebhookDispatcherService(subscriptionRepo, deliveryRepo);

export const webhooksController = new WebhooksController(
  new CreateWebhookSubscriptionUseCase(subscriptionRepo, auditService),
  new ListWebhookSubscriptionsUseCase(subscriptionRepo),
  new DeactivateWebhookSubscriptionUseCase(subscriptionRepo, auditService),
  new ListWebhookDeliveriesUseCase(deliveryRepo, subscriptionRepo),
  new ResendWebhookDeliveryUseCase(deliveryRepo, webhookDispatcherService, auditService)
);
