import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { CreateSubscriptionCheckoutUseCase } from "../../../saas-admin/application/use-cases/create-subscription-checkout.use-case";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository } from "../../../saas-admin/domain/subscription.repository";

export interface CreateOwnSubscriptionCheckoutInput {
  customerEmail: string;
  redirectUrl?: string;
  /** Si viene y es distinto al plan actual, cambia la suscripcion a ese plan ANTES de generar el
   * checkout (sin cobrar nada por el cambio en si) -- asi una empresa en TRIAL puede elegir su
   * primer plan pago desde la misma pantalla, en vez de necesitar que el operador de la
   * plataforma se lo asigne a mano. */
  planId?: string;
}

/**
 * Resuelve cual es la suscripcion de la PROPIA empresa (nunca un id externo) y reusa
 * CreateSubscriptionCheckoutUseCase (el mismo que usa el panel de plataforma) para no duplicar la
 * logica de calculo de monto/generacion de firma -- esto es lo unico nuevo: encontrar el
 * subscriptionId correcto sin que el llamador lo mande, y el cambio de plan opcional previo.
 */
export class CreateOwnSubscriptionCheckoutUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository,
    private readonly createCheckout: CreateSubscriptionCheckoutUseCase
  ) {}

  async execute(input: CreateOwnSubscriptionCheckoutInput) {
    const companyId = getTenantContext().companyId;
    const subscription = await this.subscriptionRepo.findLatestByCompanyId(companyId);
    if (!subscription) throw new NotFoundError("Subscription");

    if (input.planId && input.planId !== subscription.planId) {
      const newPlan = await this.planRepo.findByIdOrThrow(input.planId);
      if (newPlan.code === "TRIAL") {
        throw new ValidationError("No podes cambiar a un plan de prueba, elegi un plan pago");
      }
      await this.subscriptionRepo.updatePlan(subscription.id, input.planId);
    }

    return this.createCheckout.execute({
      subscriptionId: subscription.id,
      customerEmail: input.customerEmail,
      redirectUrl: input.redirectUrl,
    });
  }
}
