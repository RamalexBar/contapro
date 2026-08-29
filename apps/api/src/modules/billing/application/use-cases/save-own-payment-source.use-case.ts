import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { SavePaymentSourceUseCase } from "../../../saas-admin/application/use-cases/save-payment-source.use-case";
import type { ISubscriptionRepository, SubscriptionRecord } from "../../../saas-admin/domain/subscription.repository";

export interface SaveOwnPaymentSourceInput {
  cardToken: string;
  customerEmail: string;
  acceptanceToken: string;
}

/** Resuelve cual es la suscripcion de la PROPIA empresa y reusa SavePaymentSourceUseCase (el
 * mismo que usaria el panel de plataforma) -- mismo patron que CreateOwnSubscriptionCheckoutUseCase. */
export class SaveOwnPaymentSourceUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly savePaymentSource: SavePaymentSourceUseCase
  ) {}

  async execute(input: SaveOwnPaymentSourceInput): Promise<SubscriptionRecord> {
    const companyId = getTenantContext().companyId;
    const subscription = await this.subscriptionRepo.findLatestByCompanyId(companyId);
    if (!subscription) throw new NotFoundError("Subscription");

    return this.savePaymentSource.execute({ subscriptionId: subscription.id, ...input });
  }
}
