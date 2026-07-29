import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaUserRepository } from "../auth/infrastructure/prisma-user.repository";
import { PrismaRoleRepository } from "./infrastructure/prisma-role.repository";
import { PrismaPermissionRepository } from "./infrastructure/prisma-permission.repository";
import { PrismaUserDirectoryRepository } from "./infrastructure/prisma-user-directory.repository";
import { CreateRoleUseCase } from "./application/use-cases/create-role.use-case";
import { AssignPermissionUseCase } from "./application/use-cases/assign-permission.use-case";
import { GrantUserPermissionUseCase } from "./application/use-cases/grant-user-permission.use-case";
import { ListEffectivePermissionsUseCase } from "./application/use-cases/list-effective-permissions.use-case";
import { AssignRoleUseCase } from "./application/use-cases/assign-role.use-case";
import { RemoveRoleUseCase } from "./application/use-cases/remove-role.use-case";
import { RbacController } from "./interfaces/rbac.controller";

const roleRepo = new PrismaRoleRepository();
const permissionRepo = new PrismaPermissionRepository();
const userDirectoryRepo = new PrismaUserDirectoryRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const userRepo = new PrismaUserRepository();

export const rbacController = new RbacController(
  roleRepo,
  permissionRepo,
  userDirectoryRepo,
  new CreateRoleUseCase(roleRepo),
  new AssignPermissionUseCase(roleRepo, permissionRepo, auditService),
  new GrantUserPermissionUseCase(permissionRepo, auditService),
  new ListEffectivePermissionsUseCase(userRepo),
  new AssignRoleUseCase(userDirectoryRepo, auditService),
  new RemoveRoleUseCase(userDirectoryRepo, auditService)
);
