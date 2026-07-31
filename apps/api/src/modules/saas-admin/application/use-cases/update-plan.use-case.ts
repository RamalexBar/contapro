import type { IPlanRepository, PlanRecord, UpdatePlanData } from "../../domain/plan.repository";

export class UpdatePlanUseCase {
  constructor(private readonly repo: IPlanRepository) {}

  execute(id: string, data: UpdatePlanData): Promise<PlanRecord> {
    return this.repo.update(id, data);
  }
}
