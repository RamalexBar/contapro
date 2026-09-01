import { getTenantContext } from "../../../../shared/context/request-context";
import type { BranchRecord, IBranchRepository } from "../../domain/branch.repository";

export class ListBranchesUseCase {
  constructor(private readonly repo: IBranchRepository) {}
  async execute(): Promise<BranchRecord[]> {
    return this.repo.list(getTenantContext().companyId);
  }
}
