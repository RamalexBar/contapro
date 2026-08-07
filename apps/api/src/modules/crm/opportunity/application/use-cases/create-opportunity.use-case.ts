import { getTenantContext } from "../../../../../shared/context/request-context";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IOpportunityRepository, OpportunityItemInput, OpportunityRecord } from "../../domain/opportunity.repository";

export interface CreateOpportunityInput {
  branchId: string;
  customerId: string;
  ownerUserId?: string;
  title: string;
  description?: string;
  expectedCloseDate?: Date;
  items: OpportunityItemInput[];
}

export class CreateOpportunityUseCase {
  constructor(private readonly repo: IOpportunityRepository, private readonly audit: AuditService) {}

  async execute(input: CreateOpportunityInput): Promise<OpportunityRecord> {
    const ctx = getTenantContext();
    const opportunity = await this.repo.create({
      branchId: input.branchId,
      customerId: input.customerId,
      ownerUserId: input.ownerUserId ?? ctx.userId,
      title: input.title,
      description: input.description,
      expectedCloseDate: input.expectedCloseDate,
      items: input.items,
    });

    await this.audit.record({
      action: "OPPORTUNITY_CREATED",
      entityType: "Opportunity",
      entityId: opportunity.id,
      description: `Oportunidad "${opportunity.title}" creada por ${opportunity.expectedValue}`,
      metadata: { expectedValue: opportunity.expectedValue },
    });

    return opportunity;
  }
}
