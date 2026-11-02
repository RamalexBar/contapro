import {
  planRepo,
  subscriptionRepo,
  createSubscriptionCheckoutUseCase,
  savePaymentSourceUseCase,
  disableAutoRenewUseCase,
} from "../saas-admin/saas-admin.container";
import { GetOwnSubscriptionUseCase } from "./application/use-cases/get-own-subscription.use-case";
import { CreateOwnSubscriptionCheckoutUseCase } from "./application/use-cases/create-own-subscription-checkout.use-case";
import { SaveOwnPaymentSourceUseCase } from "./application/use-cases/save-own-payment-source.use-case";
import { DisableOwnAutoRenewUseCase } from "./application/use-cases/disable-own-auto-renew.use-case";
import { GetSubscriptionAccessUseCase } from "./application/use-cases/get-subscription-access.use-case";
import { BillingController } from "./interfaces/billing.controller";
import { registerSubscriptionAccessChecker } from "../../shared/middlewares/subscription-access.middleware";

// Solo lectura para las empresas suspendidas: el middleware compartido le pregunta a este caso de uso.
const getSubscriptionAccessUseCase = new GetSubscriptionAccessUseCase(subscriptionRepo, planRepo);
registerSubscriptionAccessChecker(async (companyId) => {
  const access = await getSubscriptionAccessUseCase.execute(companyId);
  return access?.readOnly ? { billedByCajapro: access.billedByCajapro } : null;
});

// Reusa las instancias de saas-admin.container.ts (mismo repo/gateway/caso de uso, no una copia)
// -- este modulo solo agrega la capa tenant-facing encima (resolver "mi propia empresa" en vez de
// recibir un id externo), ver README.
export const billingController = new BillingController(
  new GetOwnSubscriptionUseCase(subscriptionRepo, planRepo),
  new CreateOwnSubscriptionCheckoutUseCase(subscriptionRepo, planRepo, createSubscriptionCheckoutUseCase),
  new SaveOwnPaymentSourceUseCase(subscriptionRepo, savePaymentSourceUseCase),
  new DisableOwnAutoRenewUseCase(subscriptionRepo, disableAutoRenewUseCase),
  getSubscriptionAccessUseCase
);
