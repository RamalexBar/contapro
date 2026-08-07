import { basePrisma } from "@erp/database";
import type { IPasswordResetTokenRepository, PasswordResetTokenRecord } from "../domain/password-reset-token.repository";

/** Usa basePrisma (sin extension de tenant), mismo criterio que PrismaUserRepository: el flujo de
 * "olvide mi contrasena" corre ANTES de que exista un TenantContext (el usuario todavia no esta
 * autenticado). */
export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetTokenRecord> {
    return basePrisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  async findValidByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return basePrisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async markUsed(id: string): Promise<void> {
    await basePrisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}
