import type { IPlanRepository, PlanRecord } from "../../domain/plan.repository";

export class ListPlansUseCase {
  constructor(private readonly repo: IPlanRepository) {}

  execute(): Promise<PlanRecord[]> {
    return this.repo.list();
  }
}
