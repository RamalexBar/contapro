import type { IUserRepository } from "../../domain/user.repository";
import { sha256 } from "../../infrastructure/password-hasher.service";
import type { AuditService } from "../../../audit/application/audit.service";

export class LogoutUseCase {
  constructor(private readonly userRepo: IUserRepository, private readonly audit: AuditService) {}

  async execute(refreshToken: string): Promise<void> {
    const stored = await this.userRepo.findRefreshToken(sha256(refreshToken));
    if (stored && !stored.revokedAt) {
      await this.userRepo.revokeRefreshToken(stored.id);
    }
    await this.audit.record({
      action: "LOGOUT",
      entityType: "User",
      entityId: stored?.userId ?? "unknown",
      description: "Cierre de sesion",
    });
  }
}
