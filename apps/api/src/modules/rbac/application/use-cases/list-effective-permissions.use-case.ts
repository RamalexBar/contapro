import { NotFoundError } from "../../../../shared/errors/app-error";
import type { IUserRepository } from "../../../auth/domain/user.repository";

export class ListEffectivePermissionsUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const user = await this.userRepo.findByIdWithAccess(userId);
    if (!user) throw new NotFoundError("User", userId);
    return { roles: user.roles, permissions: user.permissions };
  }
}
