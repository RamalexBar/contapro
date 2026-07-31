import type { CompanyWithSubscriptionRecord, ISubscriptionRepository } from "../../domain/subscription.repository";

export class ListCompaniesUseCase {
  constructor(private readonly repo: ISubscriptionRepository) {}

  execute(): Promise<CompanyWithSubscriptionRecord[]> {
    return this.repo.listCompaniesWithSubscription();
  }
}
