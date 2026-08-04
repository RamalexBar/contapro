import type { NextFunction, Request, Response } from "express";
import type { GetOwnSubscriptionUseCase } from "../application/use-cases/get-own-subscription.use-case";
import type { CreateOwnSubscriptionCheckoutUseCase } from "../application/use-cases/create-own-subscription-checkout.use-case";
import { createOwnCheckoutSchema } from "./billing.validators";

export class BillingController {
  constructor(
    private readonly getOwnSubscriptionUseCase: GetOwnSubscriptionUseCase,
    private readonly createOwnSubscriptionCheckoutUseCase: CreateOwnSubscriptionCheckoutUseCase
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
}
