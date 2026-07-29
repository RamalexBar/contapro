import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserDirectoryRepository } from "../../domain/rbac.types";

export class AssignRoleUseCase {
  constructor(private readonly userDirectoryRepo: IUserDirectoryRepository, private readonly audit: AuditService) {}

  async execute(companyId: string, userId: string, roleId: string): Promise<void> {
    await this.userDirectoryRepo.assignRole(companyId, userId, roleId);

    await this.audit.record({
      action: "ROLE_ASSIGNED",
      entityType: "User",
      entityId: userId,
      description: `Rol asignado (roleId: ${roleId})`,
    });
  }
}
