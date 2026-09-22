import { getTenantContext } from "../../../../shared/context/request-context";
import type { IElectronicDocumentUsageRepository } from "../../domain/electronic-document-usage.repository";
import type { ISubscriptionRepository } from "../../../saas-admin/domain/subscription.repository";
import type { IPlanRepository } from "../../../saas-admin/domain/plan.repository";

export interface ElectronicDocumentUsageSummary {
  documentsThisMonth: number;
  planCode: string | null;
  planName: string | null;
  /** null = sin tope (empresa sin suscripcion activa, o el plan no tiene tope definido). */
  monthlyLimit: number | null;
}

/**
 * Resumen de consumo de la bolsa de documentos DIAN del mes en curso vs. el tope del plan actual
 * (ver domain/electronic-document-usage.repository.ts para el detalle de que cuenta como
 * "documento"). Solo lectura -- no bloquea nada, es para que la empresa (y Contapro) vean si se
 * estan acercando al tope acordado, ver README del modulo.
 */
export class GetElectronicDocumentUsageUseCase {
  constructor(
    private readonly usageRepo: IElectronicDocumentUsageRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository
  ) {}

  async execute(): Promise<ElectronicDocumentUsageSummary> {
    const companyId = getTenantContext().companyId;
    const documentsThisMonth = await this.usageRepo.countThisMonth();

    const subscription = await this.subscriptionRepo.findActiveByCompanyId(companyId);
    if (!subscription) {
      return { documentsThisMonth, planCode: null, planName: null, monthlyLimit: null };
    }

    const plan = await this.planRepo.findByIdOrThrow(subscription.planId);
    return {
      documentsThisMonth,
      planCode: plan.code,
      planName: plan.name,
      monthlyLimit: plan.maxElectronicDocumentsPerMonth,
    };
  }
}
