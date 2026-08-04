import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaPlatformAdminRepository } from "./infrastructure/prisma-platform-admin.repository";
import { PrismaPlanRepository } from "./infrastructure/prisma-plan.repository";
import { PrismaSubscriptionRepository } from "./infrastructure/prisma-subscription.repository";
import { ResendEmailNotifier } from "./infrastructure/resend-email-notifier";
import { WompiPaymentGateway } from "./infrastructure/wompi-payment-gateway";
import { LoginPlatformAdminUseCase } from "./application/use-cases/login-platform-admin.use-case";
import { CreatePlanUseCase } from "./application/use-cases/create-plan.use-case";
import { ListPlansUseCase } from "./application/use-cases/list-plans.use-case";
import { UpdatePlanUseCase } from "./application/use-cases/update-plan.use-case";
import { CreateSubscriptionUseCase } from "./application/use-cases/create-subscription.use-case";
import { ListSubscriptionsUseCase } from "./application/use-cases/list-subscriptions.use-case";
import { GetSubscriptionUseCase } from "./application/use-cases/get-subscription.use-case";
import { RegisterSubscriptionPaymentUseCase } from "./application/use-cases/register-subscription-payment.use-case";
import { ListCompaniesUseCase } from "./application/use-cases/list-companies.use-case";
import { GetSaasDashboardUseCase } from "./application/use-cases/get-saas-dashboard.use-case";
import { RunSubscriptionLifecycleUseCase } from "./application/use-cases/run-subscription-lifecycle.use-case";
import { CreateSubscriptionCheckoutUseCase } from "./application/use-cases/create-subscription-checkout.use-case";
import { ConfirmWompiPaymentUseCase } from "./application/use-cases/confirm-wompi-payment.use-case";
import { SaasAdminController } from "./interfaces/saas-admin.controller";

const platformAdminRepo = new PrismaPlatformAdminRepository();
const planRepo = new PrismaPlanRepository();
const subscriptionRepo = new PrismaSubscriptionRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const paymentGateway = new WompiPaymentGateway();

export const saasAdminController = new SaasAdminController(
  new LoginPlatformAdminUseCase(platformAdminRepo),
  new CreatePlanUseCase(planRepo),
  new ListPlansUseCase(planRepo),
  new UpdatePlanUseCase(planRepo),
  new CreateSubscriptionUseCase(subscriptionRepo, auditService),
  new ListSubscriptionsUseCase(subscriptionRepo),
  new GetSubscriptionUseCase(subscriptionRepo),
  new RegisterSubscriptionPaymentUseCase(subscriptionRepo, auditService),
  new ListCompaniesUseCase(subscriptionRepo),
  new GetSaasDashboardUseCase(subscriptionRepo),
  new CreateSubscriptionCheckoutUseCase(subscriptionRepo, planRepo, paymentGateway),
  new ConfirmWompiPaymentUseCase(subscriptionRepo, paymentGateway, auditService)
);

/** Usado por server.ts para arrancar el poller de recordatorios/vencimientos/suspension. */
export const runSubscriptionLifecycleUseCase = new RunSubscriptionLifecycleUseCase(
  subscriptionRepo,
  new ResendEmailNotifier(),
  auditService
);
