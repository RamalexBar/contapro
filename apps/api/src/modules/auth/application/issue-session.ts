import crypto from "node:crypto";
import type { AuditService } from "../../audit/application/audit.service";
import type { IUserRepository, UserWithAccess } from "../domain/user.repository";
import { signAccessToken, signRefreshToken } from "../infrastructure/jwt.service";
import { sha256 } from "../infrastructure/password-hasher.service";

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
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
 * Abre la sesion de un usuario ya verificado (con clave, o con un enlace de un solo uso): tokens de acceso y de
 * refresco, ultimo ingreso y la auditoria LOGIN_SUCCESS. Un solo lugar para que todas las formas de entrar den
 * exactamente la misma sesion.
 */
export async function issueSession(
  userRepo: IUserRepository,
  audit: AuditService,
  user: UserWithAccess,
  meta: { ipAddress?: string; userAgent?: string },
  description: string
): Promise<IssuedSession> {
  await userRepo.resetFailedLogins(user.id);
  await userRepo.updateLastLogin(user.id);

  const accessToken = signAccessToken({
    sub: user.id,
    companyId: user.companyId,
    branchId: user.defaultBranchId,
    roles: user.roles,
    permissions: user.permissions,
  });

  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, tokenId });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await userRepo.saveRefreshToken(user.id, tokenId, sha256(refreshToken), expiresAt, meta.ipAddress);

  await audit.recordWithoutContext(user.companyId, user.id, { action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id, description }, meta);

  return {
    accessToken,
    refreshToken,
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
