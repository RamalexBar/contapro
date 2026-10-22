import type { IPlatformAdminRepository, PlatformAdminSummary } from "../../domain/platform-admin.repository";

export class ListPlatformAdminsUseCase {
  constructor(private readonly repo: IPlatformAdminRepository) {}

  execute(): Promise<PlatformAdminSummary[]> {
    return this.repo.list();
  }
}
