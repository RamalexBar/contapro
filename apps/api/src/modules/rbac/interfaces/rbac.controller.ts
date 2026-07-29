import type { NextFunction, Request, Response } from "express";
import { getTenantContext } from "../../../shared/context/request-context";
import type { CreateRoleUseCase } from "../application/use-cases/create-role.use-case";
import type { AssignPermissionUseCase } from "../application/use-cases/assign-permission.use-case";
import type { GrantUserPermissionUseCase } from "../application/use-cases/grant-user-permission.use-case";
import type { ListEffectivePermissionsUseCase } from "../application/use-cases/list-effective-permissions.use-case";
import type { AssignRoleUseCase } from "../application/use-cases/assign-role.use-case";
import type { RemoveRoleUseCase } from "../application/use-cases/remove-role.use-case";
import type { IPermissionRepository, IRoleRepository, IUserDirectoryRepository } from "../domain/rbac.types";
import {
  assignPermissionsSchema,
  assignRoleSchema,
  createRoleSchema,
  grantUserPermissionSchema,
} from "./rbac.validators";

export class RbacController {
  constructor(
    private readonly roleRepo: IRoleRepository,
    private readonly permissionRepo: IPermissionRepository,
    private readonly userDirectoryRepo: IUserDirectoryRepository,
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly assignPermissionUseCase: AssignPermissionUseCase,
    private readonly grantUserPermissionUseCase: GrantUserPermissionUseCase,
    private readonly listEffectivePermissionsUseCase: ListEffectivePermissionsUseCase,
    private readonly assignRoleUseCase: AssignRoleUseCase,
    private readonly removeRoleUseCase: RemoveRoleUseCase
  ) {}

  listUsers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.userDirectoryRepo.list() });
    } catch (err) {
      next(err);
    }
  };

  assignRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      const body = assignRoleSchema.parse(req.body);
      await this.assignRoleUseCase.execute(ctx.companyId, req.params.userId, body.roleId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  removeRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.removeRoleUseCase.execute(req.params.userId, req.params.roleId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  listRoles = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      res.json({ data: await this.roleRepo.list(ctx.companyId) });
    } catch (err) {
      next(err);
    }
  };

  listPermissions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.permissionRepo.listAll() });
    } catch (err) {
      next(err);
    }
  };

  createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      const body = createRoleSchema.parse(req.body);
      res.status(201).json(await this.createRoleUseCase.execute(ctx.companyId, body.name));
    } catch (err) {
      next(err);
    }
  };

  assignPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getTenantContext();
      const body = assignPermissionsSchema.parse(req.body);
      await this.assignPermissionUseCase.execute(ctx.companyId, req.params.roleId, body.permissionCodes);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  grantUserPermission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = grantUserPermissionSchema.parse(req.body);
      await this.grantUserPermissionUseCase.execute({ userId: req.params.userId, ...body });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  effectivePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.listEffectivePermissionsUseCase.execute(req.params.userId));
    } catch (err) {
      next(err);
    }
  };
}
