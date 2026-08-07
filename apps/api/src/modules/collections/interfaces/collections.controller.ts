import type { NextFunction, Request, Response } from "express";
import { wompiWebhookSchema } from "../../saas-admin/interfaces/saas-admin.validators";
import type { ListAccountsReceivableUseCase } from "../application/use-cases/list-accounts-receivable.use-case";
import type { RegisterReceivablePaymentUseCase } from "../application/use-cases/register-receivable-payment.use-case";
import type { CreateReceivableCheckoutUseCase } from "../application/use-cases/create-receivable-checkout.use-case";
import type { ConfirmReceivableWompiPaymentUseCase } from "../application/use-cases/confirm-receivable-wompi-payment.use-case";
import { createReceivableCheckoutSchema, registerReceivablePaymentSchema } from "./collections.validators";

export class CollectionsController {
  constructor(
    private readonly listAccountsReceivableUseCase: ListAccountsReceivableUseCase,
    private readonly registerReceivablePaymentUseCase: RegisterReceivablePaymentUseCase,
    private readonly createReceivableCheckoutUseCase: CreateReceivableCheckoutUseCase,
    private readonly confirmReceivableWompiPaymentUseCase: ConfirmReceivableWompiPaymentUseCase
  ) {}

  listAccountsReceivable = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json({ data: await this.listAccountsReceivableUseCase.execute({ status }) });
    } catch (err) {
      next(err);
    }
  };

  registerPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerReceivablePaymentSchema.parse(req.body);
      res.status(201).json(await this.registerReceivablePaymentUseCase.execute({ accountReceivableId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  createCheckout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createReceivableCheckoutSchema.parse(req.body);
      res.status(201).json(await this.createReceivableCheckoutUseCase.execute({ accountReceivableId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  // Publica a proposito -- la llama Wompi, no un usuario autenticado (mismo criterio que
  // saasAdminController.wompiWebhook).
  wompiWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = wompiWebhookSchema.parse(req.body);
      await this.confirmReceivableWompiPaymentUseCase.execute(event);
      res.status(200).json({ received: true });
    } catch (err) {
      next(err);
    }
  };
}
