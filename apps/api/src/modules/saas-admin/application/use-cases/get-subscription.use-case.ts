import type { ISubscriptionRepository, SubscriptionRecord } from "../../domain/subscription.repository";

export class GetSubscriptionUseCase {
  constructor(private readonly repo: ISubscriptionRepository) {}

  execute(id: string): Promise<SubscriptionRecord> {
    return this.repo.findByIdOrThrow(id);
  }
}
