import { prisma } from "../../../../shared/prisma/prisma-client";
import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPermissionRepository } from "../../domain/rbac.types";

export interface GrantUserPermissionInput {
  userId: string;
  permissionCode: string;
  granted: boolean; // true = concede permiso extra, false = revoca explicitamente
}

/** Override individual de permisos por usuario (independiente de su(s) rol(es)). */
export class GrantUserPermissionUseCase {
  constructor(private readonly permissionRepo: IPermissionRepository, private readonly audit: AuditService) {}

  async execute(input: GrantUserPermissionInput): Promise<void> {
    const [permission] = await this.permissionRepo.findByCodes([input.permissionCode]);
    if (!permission) throw new ValidationError(`Permiso desconocido: ${input.permissionCode}`);

    const user = await prisma.user.findFirst({ where: { id: input.userId } });
    if (!user) throw new NotFoundError("User", input.userId);

    await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: input.userId, permissionId: permission.id } },
      create: { userId: input.userId, permissionId: permission.id, granted: input.granted },
      update: { granted: input.granted },
    });

    await this.audit.record({
      action: "PERMISSION_CHANGED",
      entityType: "User",
      entityId: input.userId,
      description: `Override de permiso '${input.permissionCode}' = ${input.granted}`,
    });
  }
}
