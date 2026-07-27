import { ForbiddenError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPermissionRepository, IRoleRepository } from "../../domain/rbac.types";

export class AssignPermissionUseCase {
  constructor(
    private readonly roleRepo: IRoleRepository,
    private readonly permissionRepo: IPermissionRepository,
    private readonly audit: AuditService
  ) {}

  async execute(companyId: string, roleId: string, permissionCodes: string[]): Promise<void> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError("Role", roleId);

    // Los roles de sistema (companyId null, ej. ADMINISTRADOR/CAJERO) son compartidos entre
    // TODAS las empresas: no se pueden editar desde una empresa individual.
    if (role.isSystem || role.companyId === null) {
      throw new ForbiddenError("No se pueden editar los permisos de un rol de sistema");
    }
    if (role.companyId !== companyId) {
      throw new ForbiddenError("Este rol no pertenece a tu empresa");
    }

    const permissions = await this.permissionRepo.findByCodes(permissionCodes);
    if (permissions.length !== permissionCodes.length) {
      throw new ValidationError("Uno o mas codigos de permiso no existen");
    }

    await this.roleRepo.setPermissions(
      roleId,
      permissions.map((p) => p.id)
    );

    await this.audit.record({
      action: "PERMISSION_CHANGED",
      entityType: "Role",
      entityId: roleId,
      description: `Permisos actualizados para el rol ${role.name}`,
      metadata: { permissionCodes },
    });
  }
}
