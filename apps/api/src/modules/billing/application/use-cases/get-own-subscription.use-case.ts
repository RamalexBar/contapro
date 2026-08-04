import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { IPlanRepository, PlanRecord } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository, SubscriptionRecord } from "../../../saas-admin/domain/subscription.repository";

export interface OwnSubscriptionResult {
  subscription: SubscriptionRecord;
  plan: PlanRecord;
  /** Planes pagos disponibles (excluye TRIAL) para el selector "cambiar de plan" -- solo tiene
   * sentido mostrarlo mientras la suscripcion siga en TRIALING (ver README del modulo). */
  availablePlans: PlanRecord[];
}

/**
 * "Mi suscripcion": a diferencia de todo lo demas en modules/saas-admin (transversal a TODAS las
 * empresas, protegido por requirePlatformAdmin), esto corre bajo tenantContextMiddleware -- una
 * empresa viendo SU PROPIA suscripcion, resuelta desde el companyId del JWT, nunca de un id que
 * venga en la URL/body (evita que una empresa pueda ver la suscripcion de otra con solo cambiar
 * un id). Usa findLatestByCompanyId (no findActiveByCompanyId) para poder mostrar el estado real
 * aunque este SUSPENDED/CANCELLED, en vez de un 404 confuso.
 */
export class GetOwnSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository
  ) {}

  async execute(): Promise<OwnSubscriptionResult> {
    const companyId = getTenantContext().companyId;
    const subscription = await this.subscriptionRepo.findLatestByCompanyId(companyId);
    if (!subscription) throw new NotFoundError("Subscription");

    const [plan, allPlans] = await Promise.all([this.planRepo.findByIdOrThrow(subscription.planId), this.planRepo.list()]);

    return {
      subscription,
      plan,
      availablePlans: allPlans.filter((p) => p.code !== "TRIAL" && p.isActive),
    };
  }
}
