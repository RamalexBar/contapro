import crypto from "node:crypto";
import { UnauthorizedError } from "../../../../shared/errors/app-error";
import type { IUserRepository } from "../../domain/user.repository";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../infrastructure/jwt.service";
import { sha256 } from "../../infrastructure/password-hasher.service";

export class RefreshTokenUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError("Refresh token invalido o expirado");
    }

    const stored = await this.userRepo.findRefreshToken(sha256(refreshToken));
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      throw new UnauthorizedError("Refresh token invalido o revocado");
    }

    const user = await this.userRepo.findByIdWithAccess(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Usuario inactivo o inexistente");
    }

    // Rotacion: se revoca el token usado y se emite uno nuevo.
    await this.userRepo.revokeRefreshToken(stored.id);

    const accessToken = signAccessToken({
      sub: user.id,
      companyId: user.companyId,
      branchId: user.defaultBranchId,
      roles: user.roles,
      permissions: user.permissions,
    });

    const tokenId = crypto.randomUUID();
    const newRefreshToken = signRefreshToken({ sub: user.id, tokenId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await this.userRepo.saveRefreshToken(user.id, tokenId, sha256(newRefreshToken), expiresAt);

    return { accessToken, refreshToken: newRefreshToken };
  }
}
