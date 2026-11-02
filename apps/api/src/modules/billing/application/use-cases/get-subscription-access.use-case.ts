import { isCajaproComboPlan } from "../../../partner-api/application/use-cases/provision-partner-account.use-case";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository, SubscriptionStatus } from "../../../saas-admin/domain/subscription.repository";

export interface SubscriptionAccess {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  graceEndsAt: Date | null;
  /** SUSPENDED o CANCELLED: puede consultar y pagar, pero no registrar ni cambiar nada. */
  readOnly: boolean;
  /** El combo de Cajapro: se renueva en Cajapro, no en Contapro. */
  billedByCajapro: boolean;
}

const READ_ONLY_STATUSES: SubscriptionStatus[] = ["SUSPENDED", "CANCELLED"];
const CACHE_MS = 30_000;

/**
 * Estado de la suscripcion para el bloqueo de solo lectura (enforceSubscriptionWriteAccess) y para
 * el aviso de la app. Lo consulta cada request que escribe, asi que se guarda 30 s por empresa: al
 * pagar, el bloqueo se levanta a mas tardar en ese tiempo. Sin suscripcion = sin bloqueo.
 */
export class GetSubscriptionAccessUseCase {
  private readonly cache = new Map<string, { value: SubscriptionAccess | null; at: number }>();

  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository,
    private readonly now: () => number = Date.now
  ) {}

  async execute(companyId: string): Promise<SubscriptionAccess | null> {
    const hit = this.cache.get(companyId);
    if (hit && this.now() - hit.at < CACHE_MS) return hit.value;

    const subscription = await this.subscriptionRepo.findLatestByCompanyId(companyId);
    let value: SubscriptionAccess | null = null;
    if (subscription) {
      const plan = await this.planRepo.findByIdOrThrow(subscription.planId);
      value = {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        graceEndsAt: subscription.graceEndsAt,
        readOnly: READ_ONLY_STATUSES.includes(subscription.status),
        billedByCajapro: isCajaproComboPlan(plan.code),
      };
    }
    this.cache.set(companyId, { value, at: this.now() });
    return value;
  }
}
