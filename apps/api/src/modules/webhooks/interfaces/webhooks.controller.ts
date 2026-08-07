import type { NextFunction, Request, Response } from "express";
import { createWebhookSubscriptionSchema } from "./webhooks.validators";
import type { CreateWebhookSubscriptionUseCase } from "../application/use-cases/create-webhook-subscription.use-case";
import type { ListWebhookSubscriptionsUseCase } from "../application/use-cases/list-webhook-subscriptions.use-case";
import type { DeactivateWebhookSubscriptionUseCase } from "../application/use-cases/deactivate-webhook-subscription.use-case";
import type { ListWebhookDeliveriesUseCase } from "../application/use-cases/list-webhook-deliveries.use-case";
import type { ResendWebhookDeliveryUseCase } from "../application/use-cases/resend-webhook-delivery.use-case";

export class WebhooksController {
  constructor(
    private readonly createUseCase: CreateWebhookSubscriptionUseCase,
    private readonly listUseCase: ListWebhookSubscriptionsUseCase,
    private readonly deactivateUseCase: DeactivateWebhookSubscriptionUseCase,
    private readonly listDeliveriesUseCase: ListWebhookDeliveriesUseCase,
    private readonly resendUseCase: ResendWebhookDeliveryUseCase
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createWebhookSubscriptionSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.deactivateUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  listDeliveries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listDeliveriesUseCase.execute(req.params.id) });
    } catch (err) {
      next(err);
    }
  };

  resendDelivery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resendUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
