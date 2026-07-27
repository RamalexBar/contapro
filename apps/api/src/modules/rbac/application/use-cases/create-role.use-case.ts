import type { IRoleRepository, RoleWithPermissions } from "../../domain/rbac.types";

export class CreateRoleUseCase {
  constructor(private readonly roleRepo: IRoleRepository) {}

  async execute(companyId: string, name: string): Promise<RoleWithPermissions> {
    return this.roleRepo.create(companyId, name);
  }
}
