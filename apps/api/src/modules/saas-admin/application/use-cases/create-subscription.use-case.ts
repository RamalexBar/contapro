import type { AuditService } from "../../../audit/application/audit.service";
import type { CreateSubscriptionData, ISubscriptionRepository, SubscriptionRecord } from "../../domain/subscription.repository";

/** Asignacion manual de plan a una empresa (alta/upgrade por un admin de plataforma) -- distinta
 * de la suscripcion TRIALING que RegisterCompanyUseCase (modules/auth) crea automaticamente al
 * registrarse una empresa nueva. */
export class CreateSubscriptionUseCase {
  constructor(private readonly repo: ISubscriptionRepository, private readonly audit: AuditService) {}

  async execute(data: CreateSubscriptionData, platformAdminId: string): Promise<SubscriptionRecord> {
    const subscription = await this.repo.create(data);

    await this.audit.recordWithoutContext(data.companyId, platformAdminId, {
      action: "SUBSCRIPTION_CREATED",
      entityType: "Subscription",
      entityId: subscription.id,
      description: `Suscripcion creada: plan ${data.planId}, estado ${data.status}`,
    });

    return subscription;
  }
}
