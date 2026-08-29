import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { DisableAutoRenewUseCase } from "../../../saas-admin/application/use-cases/disable-auto-renew.use-case";
import type { ISubscriptionRepository, SubscriptionRecord } from "../../../saas-admin/domain/subscription.repository";

/** Resuelve cual es la suscripcion de la PROPIA empresa y reusa DisableAutoRenewUseCase -- mismo
 * patron que SaveOwnPaymentSourceUseCase/CreateOwnSubscriptionCheckoutUseCase. Es el "cancelar" que
 * pidio el usuario: deja de cobrar automatico, la suscripcion sigue vigente hasta que venza. */
export class DisableOwnAutoRenewUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly disableAutoRenew: DisableAutoRenewUseCase
  ) {}

  async execute(): Promise<SubscriptionRecord> {
    const companyId = getTenantContext().companyId;
    const subscription = await this.subscriptionRepo.findLatestByCompanyId(companyId);
    if (!subscription) throw new NotFoundError("Subscription");

    return this.disableAutoRenew.execute(subscription.id);
  }
}
