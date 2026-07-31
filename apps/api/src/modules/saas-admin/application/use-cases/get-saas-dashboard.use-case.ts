import type { ISubscriptionRepository, SaasDashboardStats } from "../../domain/subscription.repository";

export class GetSaasDashboardUseCase {
  constructor(private readonly repo: ISubscriptionRepository) {}

  execute(): Promise<SaasDashboardStats> {
    return this.repo.getDashboardStats();
  }
}
