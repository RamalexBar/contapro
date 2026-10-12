import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserRepository, SelectableBranch } from "../../domain/user.repository";
import { signAccessToken } from "../../infrastructure/jwt.service";

export interface SwitchBranchInput {
  userId: string;
  companyId: string;
  branchId: string;
  /** Quien administra sucursales (branch.manage) puede entrar a cualquiera sin estar asignado. */
  canManageBranches: boolean;
}

export interface SwitchBranchOutput {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    companyId: string;
    branchId: string | null;
    roles: string[];
    permissions: string[];
  };
}

/**
 * Cambia la sucursal en la que trabaja el usuario (ventas, caja y compras salen de esta). Queda
 * guardada como su sucursal por defecto, asi que el proximo inicio de sesion y cada refresh del
 * token ya entran en ella. Devuelve un access token nuevo con el branchId cambiado; el refresh
 * token sigue sirviendo porque lee la sucursal por defecto al rotar.
 */
export class SwitchBranchUseCase {
  constructor(private readonly userRepo: IUserRepository, private readonly audit: AuditService) {}

  async listSelectable(userId: string, companyId: string, canManageBranches: boolean): Promise<SelectableBranch[]> {
    return this.userRepo.listSelectableBranches(companyId, userId, canManageBranches);
  }

  async execute(input: SwitchBranchInput): Promise<SwitchBranchOutput> {
    const selectable = await this.userRepo.listSelectableBranches(input.companyId, input.userId, input.canManageBranches);
    const branch = selectable.find((b) => b.id === input.branchId);
    if (!branch) {
      const exists = await this.userRepo.listSelectableBranches(input.companyId, input.userId, true);
      if (!exists.some((b) => b.id === input.branchId)) throw new NotFoundError("Branch", input.branchId);
      throw new ForbiddenError("No estas asignado a esa sucursal. Pidele al administrador que te la asigne.");
    }

    await this.userRepo.setDefaultBranch(input.userId, branch.id);

    const user = await this.userRepo.findByIdWithAccess(input.userId);
    if (!user || !user.isActive) throw new UnauthorizedError("Usuario inactivo o inexistente");

    const accessToken = signAccessToken({
      sub: user.id,
      companyId: user.companyId,
      branchId: user.defaultBranchId,
      roles: user.roles,
      permissions: user.permissions,
    });

    await this.audit.record({
      action: "BRANCH_SWITCHED",
      entityType: "User",
      entityId: user.id,
      description: `${user.fullName} paso a trabajar en la sucursal ${branch.name}`,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyId: user.companyId,
        branchId: user.defaultBranchId,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }
}
