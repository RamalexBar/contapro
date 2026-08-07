import type { IOpportunityRepository, OpportunityListFilter, OpportunityRecord } from "../../domain/opportunity.repository";

export class ListOpportunitiesUseCase {
  constructor(private readonly repo: IOpportunityRepository) {}

  async execute(filter?: OpportunityListFilter): Promise<OpportunityRecord[]> {
    return this.repo.list(filter);
  }
}
