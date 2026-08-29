import type { NextFunction, Request, Response } from "express";
import type { GetOwnSubscriptionUseCase } from "../application/use-cases/get-own-subscription.use-case";
import type { CreateOwnSubscriptionCheckoutUseCase } from "../application/use-cases/create-own-subscription-checkout.use-case";
import type { SaveOwnPaymentSourceUseCase } from "../application/use-cases/save-own-payment-source.use-case";
import type { DisableOwnAutoRenewUseCase } from "../application/use-cases/disable-own-auto-renew.use-case";
import { createOwnCheckoutSchema, saveOwnPaymentSourceSchema } from "./billing.validators";

export class BillingController {
  constructor(
    private readonly getOwnSubscriptionUseCase: GetOwnSubscriptionUseCase,
    private readonly createOwnSubscriptionCheckoutUseCase: CreateOwnSubscriptionCheckoutUseCase,
    private readonly saveOwnPaymentSourceUseCase: SaveOwnPaymentSourceUseCase,
    private readonly disableOwnAutoRenewUseCase: DisableOwnAutoRenewUseCase
  ) {}

  getOwnSubscription = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getOwnSubscriptionUseCase.execute());
    } catch (err) {
      next(err);
    }
  };

  createOwnCheckout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createOwnCheckoutSchema.parse(req.body);
      res.status(201).json(await this.createOwnSubscriptionCheckoutUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  savePaymentSource = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = saveOwnPaymentSourceSchema.parse(req.body);
      res.status(201).json(await this.saveOwnPaymentSourceUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  disableAutoRenew = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.disableOwnAutoRenewUseCase.execute());
    } catch (err) {
      next(err);
    }
  };
}
