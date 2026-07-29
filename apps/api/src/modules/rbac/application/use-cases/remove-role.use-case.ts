import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserDirectoryRepository } from "../../domain/rbac.types";

export class RemoveRoleUseCase {
  constructor(private readonly userDirectoryRepo: IUserDirectoryRepository, private readonly audit: AuditService) {}

  async execute(userId: string, roleId: string): Promise<void> {
    await this.userDirectoryRepo.removeRole(userId, roleId);

    await this.audit.record({
      action: "ROLE_REMOVED",
      entityType: "User",
      entityId: userId,
      description: `Rol removido (roleId: ${roleId})`,
    });
  }
}
