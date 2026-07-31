import type { CreatePlanData, IPlanRepository, PlanRecord } from "../../domain/plan.repository";

export class CreatePlanUseCase {
  constructor(private readonly repo: IPlanRepository) {}

  execute(data: CreatePlanData): Promise<PlanRecord> {
    return this.repo.create(data);
  }
}
