import type { SetUserBranchesInput } from "@erp/shared-types";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserDirectoryRepository, UserSummary } from "../../domain/rbac.types";

/**
 * Sucursales en las que trabaja un usuario (por ejemplo, el cajero de la sede Norte). Con la
 * sucursal por defecto entra al iniciar sesion; si tiene varias, cambia desde la barra superior
 * (POST /auth/switch-branch). Solo sucursales activas de la propia empresa.
 */
export class SetUserBranchesUseCase {
  constructor(private readonly userDirectoryRepo: IUserDirectoryRepository, private readonly audit: AuditService) {}

  async execute(userId: string, input: SetUserBranchesInput): Promise<UserSummary> {
    const branchIds = [...new Set(input.branchIds)];
    const found = await this.userDirectoryRepo.findActiveBranches(branchIds);
    if (found.length !== branchIds.length) {
      throw new ValidationError("Alguna de las sucursales elegidas no existe o esta desactivada");
    }

    const user = await this.userDirectoryRepo.setBranches(userId, branchIds, input.defaultBranchId);

    await this.audit.record({
      action: "USER_BRANCHES_CHANGED",
      entityType: "User",
      entityId: userId,
      description: `Sucursales de ${user.fullName}: ${user.branches.map((b) => (b.isDefault ? `${b.name} (por defecto)` : b.name)).join(", ")}`,
    });

    return user;
  }
}
