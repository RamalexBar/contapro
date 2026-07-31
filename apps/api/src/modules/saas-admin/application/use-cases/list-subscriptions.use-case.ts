import type { ISubscriptionRepository, SubscriptionStatus, SubscriptionWithDetails } from "../../domain/subscription.repository";

export class ListSubscriptionsUseCase {
  constructor(private readonly repo: ISubscriptionRepository) {}

  execute(status?: SubscriptionStatus): Promise<SubscriptionWithDetails[]> {
    return this.repo.list(status ? { status } : undefined);
  }
}
