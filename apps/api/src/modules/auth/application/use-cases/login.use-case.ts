import { MultipleCompaniesError, UnauthorizedError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserRepository } from "../../domain/user.repository";
import { verifySecret } from "../../infrastructure/password-hasher.service";
import { issueSession } from "../issue-session";

export interface LoginUseCaseInput {
  email: string;
  password: string;
  /** Explicito cuando el email ya disparo un MultipleCompaniesError antes y el usuario eligio
   * una empresa en el selector del frontend. Si no se manda y el email es ambiguo, se lanza
   * MultipleCompaniesError de nuevo en vez de adivinar (ver findByEmailWithAccess mas abajo). */
  companyId?: string;
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
    // El email es unico solo POR empresa, nunca globalmente -- sin companyId explicito, se
    // verifica primero si hay mas de una empresa con ese email antes de intentar autenticar,
    // en vez de resolver a una arbitraria via findFirst (comportamiento previo, no
    // determinista: podia autenticar contra la empresa equivocada segun el orden que Postgres
    // devolviera, ver hallazgo documentado al probar el registro en produccion).
    if (!input.companyId) {
      const matches = await this.userRepo.findCompaniesByEmail(input.email);
      if (matches.length > 1) {
        throw new MultipleCompaniesError(matches);
      }
    }

    const user = await this.userRepo.findByEmailWithAccess(input.companyId, input.email);

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

    return issueSession(this.userRepo, this.audit, user, requestMeta, `Login exitoso de ${user.email}`);
  }
}
