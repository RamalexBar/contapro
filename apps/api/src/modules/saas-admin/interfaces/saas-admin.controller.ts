import type { NextFunction, Request, Response } from "express";
import type { LoginPlatformAdminUseCase } from "../application/use-cases/login-platform-admin.use-case";
import type { CreatePlanUseCase } from "../application/use-cases/create-plan.use-case";
import type { ListPlansUseCase } from "../application/use-cases/list-plans.use-case";
import type { UpdatePlanUseCase } from "../application/use-cases/update-plan.use-case";
import type { CreateSubscriptionUseCase } from "../application/use-cases/create-subscription.use-case";
import type { ListSubscriptionsUseCase } from "../application/use-cases/list-subscriptions.use-case";
import type { GetSubscriptionUseCase } from "../application/use-cases/get-subscription.use-case";
import type { RegisterSubscriptionPaymentUseCase } from "../application/use-cases/register-subscription-payment.use-case";
import type { ListCompaniesUseCase } from "../application/use-cases/list-companies.use-case";
import type { GetSaasDashboardUseCase } from "../application/use-cases/get-saas-dashboard.use-case";
import type { CreateSubscriptionCheckoutUseCase } from "../application/use-cases/create-subscription-checkout.use-case";
import type { ConfirmWompiPaymentUseCase } from "../application/use-cases/confirm-wompi-payment.use-case";
import type { SubscriptionStatus } from "../domain/subscription.repository";
import {
  createPlanSchema,
  createSubscriptionCheckoutSchema,
  createSubscriptionSchema,
  loginPlatformAdminSchema,
  registerSubscriptionPaymentSchema,
  updatePlanSchema,
  wompiWebhookSchema,
} from "./saas-admin.validators";

export class SaasAdminController {
  constructor(
    private readonly loginUseCase: LoginPlatformAdminUseCase,
    private readonly createPlanUseCase: CreatePlanUseCase,
    private readonly listPlansUseCase: ListPlansUseCase,
    private readonly updatePlanUseCase: UpdatePlanUseCase,
    private readonly createSubscriptionUseCase: CreateSubscriptionUseCase,
    private readonly listSubscriptionsUseCase: ListSubscriptionsUseCase,
    private readonly getSubscriptionUseCase: GetSubscriptionUseCase,
    private readonly registerSubscriptionPaymentUseCase: RegisterSubscriptionPaymentUseCase,
    private readonly listCompaniesUseCase: ListCompaniesUseCase,
    private readonly getSaasDashboardUseCase: GetSaasDashboardUseCase,
    private readonly createSubscriptionCheckoutUseCase: CreateSubscriptionCheckoutUseCase,
    private readonly confirmWompiPaymentUseCase: ConfirmWompiPaymentUseCase
  ) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginPlatformAdminSchema.parse(req.body);
      res.json(await this.loginUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  createPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPlanSchema.parse(req.body);
      res.status(201).json(await this.createPlanUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listPlans = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listPlansUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  updatePlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updatePlanSchema.parse(req.body);
      res.json(await this.updatePlanUseCase.execute(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  createSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSubscriptionSchema.parse(req.body);
      res.status(201).json(await this.createSubscriptionUseCase.execute(body, res.locals.platformAdminId));
    } catch (err) {
      next(err);
    }
  };

  listSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = typeof req.query.status === "string" ? (req.query.status as SubscriptionStatus) : undefined;
      res.json({ data: await this.listSubscriptionsUseCase.execute(status) });
    } catch (err) {
      next(err);
    }
  };

  getSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getSubscriptionUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  registerSubscriptionPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerSubscriptionPaymentSchema.parse(req.body);
      res.status(201).json(
        await this.registerSubscriptionPaymentUseCase.execute({
          subscriptionId: req.params.id,
          ...body,
          platformAdminId: res.locals.platformAdminId,
        })
      );
    } catch (err) {
      next(err);
    }
  };

  createSubscriptionCheckout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSubscriptionCheckoutSchema.parse(req.body);
      res.status(201).json(await this.createSubscriptionCheckoutUseCase.execute({ subscriptionId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  /** Publica, sin requirePlatformAdmin -- la llama Wompi, no un usuario autenticado. La
   * autenticidad se verifica adentro del caso de uso via la firma del evento (events secret), no
   * con un JWT. Siempre responde 200 salvo error interno real (asi Wompi no reintenta
   * eternamente eventos que nunca se van a poder procesar, ej. firma invalida o evento
   * desconocido -- eso ya lo descarta el caso de uso en silencio). */
  wompiWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = wompiWebhookSchema.parse(req.body);
      await this.confirmWompiPaymentUseCase.execute(event);
      res.status(200).json({ received: true });
    } catch (err) {
      next(err);
    }
  };

  listCompanies = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listCompaniesUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getSaasDashboardUseCase.execute());
    } catch (err) {
      next(err);
    }
  };
}
