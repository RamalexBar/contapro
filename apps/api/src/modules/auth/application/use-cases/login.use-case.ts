import { UnauthorizedError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserRepository } from "../../domain/user.repository";
import { signAccessToken, signRefreshToken } from "../../infrastructure/jwt.service";
import { sha256, verifySecret } from "../../infrastructure/password-hasher.service";
import crypto from "node:crypto";

export interface LoginUseCaseInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginUseCaseOutput {
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

export class LoginUseCase {
  constructor(private readonly userRepo: IUserRepository, private readonly audit: AuditService) {}

  async execute(input: LoginUseCaseInput): Promise<LoginUseCaseOutput> {
    const user = await this.userRepo.findByEmailWithAccess(undefined, input.email);

    if (!user) {
      throw new UnauthorizedError("Credenciales invalidas");
    }

    const requestMeta = { ipAddress: input.ipAddress, userAgent: input.userAgent };

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.recordWithoutContext(
        user.companyId,
        user.id,
        { action: "LOGIN_FAILED", entityType: "User", entityId: user.id, description: "Cuenta bloqueada temporalmente" },
        requestMeta
      );
      throw new UnauthorizedError("Cuenta bloqueada temporalmente por intentos fallidos. Intenta mas tarde.");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Usuario inactivo");
    }

    const validPassword = await verifySecret(input.password, user.passwordHash);
    if (!validPassword) {
      await this.userRepo.registerFailedLogin(user.id);
      await this.audit.recordWithoutContext(
        user.companyId,
        user.id,
        { action: "LOGIN_FAILED", entityType: "User", entityId: user.id, description: "Password incorrecto" },
        requestMeta
      );
      // Nota: al superar un umbral de intentos se bloquearia la cuenta actualizando
      // lockedUntil (delegado al repositorio en una siguiente iteracion).
      throw new UnauthorizedError("Credenciales invalidas");
    }

    await this.userRepo.resetFailedLogins(user.id);
    await this.userRepo.updateLastLogin(user.id);

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
    await this.userRepo.saveRefreshToken(user.id, tokenId, sha256(refreshToken), expiresAt, input.ipAddress);

    await this.audit.recordWithoutContext(
      user.companyId,
      user.id,
      { action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id, description: `Login exitoso de ${user.email}` },
      requestMeta
    );

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
}

