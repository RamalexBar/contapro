import { randomBytes } from "node:crypto";
import { NotFoundError, UnauthorizedError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ILoginLinkRepository } from "../../domain/login-link.repository";
import type { IUserRepository } from "../../domain/user.repository";
import { sha256 } from "../../infrastructure/password-hasher.service";
import { issueSession, type IssuedSession } from "../issue-session";

/** Cuanto dura un enlace de entrada sin usarse. */
export const LOGIN_LINK_MINUTES = 5;

/**
 * Enlace de entrada de un solo uso para un usuario de una empresa: lo pide un aliado (Cajapro, boton «Entrar a
 * Contapro») con su llave secreta, para que el cliente entre sin escribir correo ni clave. Solo el hash queda en la
 * base; el token viaja una vez, en la parte `#` del enlace (los navegadores no la mandan a ningun servidor).
 */
export class CreateLoginLinkUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly linkRepo: ILoginLinkRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(input: { companyId: string; email: string; source: string }): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.userRepo.findByEmailWithAccess(input.companyId, input.email.trim().toLowerCase());
    if (!user || !user.isActive) throw new NotFoundError("Usuario");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + LOGIN_LINK_MINUTES * 60_000);
    await this.linkRepo.create({ userId: user.id, tokenHash: sha256(token), source: input.source, expiresAt });
    return { token, expiresAt };
  }
}

/** Entrar con el enlace: lo gasta (una sola vez) y abre la misma sesion que el login con clave. */
export class LoginWithLinkUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly linkRepo: ILoginLinkRepository,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(input: { token: string; ipAddress?: string; userAgent?: string }): Promise<IssuedSession> {
    const link = await this.linkRepo.consume(sha256(input.token), this.now());
    if (!link) throw new UnauthorizedError("El enlace para entrar vencio o ya se uso. Vuelva a tocar «Entrar a Contapro».");
    const user = await this.userRepo.findByIdWithAccess(link.userId);
    if (!user || !user.isActive) throw new UnauthorizedError("Usuario inactivo");
    if (user.lockedUntil && user.lockedUntil > this.now()) throw new UnauthorizedError("Cuenta bloqueada temporalmente. Intenta mas tarde.");
    const source = link.source === "CAJAPRO" ? "Cajapro" : link.source;
    return issueSession(this.userRepo, this.audit, user, input, `Entro desde ${source} (enlace de un solo uso): ${user.email}`);
  }
}
