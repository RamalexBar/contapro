import { UnauthorizedError } from "../../../../shared/errors/app-error";
import { hashSecret, sha256 } from "../../infrastructure/password-hasher.service";
import type { IUserRepository } from "../../domain/user.repository";
import type { IPasswordResetTokenRepository } from "../../domain/password-reset-token.repository";

export class ResetPasswordUseCase {
  constructor(private readonly userRepo: IUserRepository, private readonly tokenRepo: IPasswordResetTokenRepository) {}

  async execute(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.tokenRepo.findValidByTokenHash(sha256(rawToken));
    if (!record) {
      throw new UnauthorizedError("El enlace de recuperacion es invalido o ya vencio");
    }

    const passwordHash = await hashSecret(newPassword);
    await this.userRepo.updatePassword(record.userId, passwordHash);
    await this.tokenRepo.markUsed(record.id);
    await this.userRepo.revokeAllRefreshTokensForUser(record.userId);
  }
}
