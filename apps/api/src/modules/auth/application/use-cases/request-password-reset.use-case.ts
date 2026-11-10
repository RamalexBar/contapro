import crypto from "node:crypto";
import { env } from "../../../../config/env";
import { sha256 } from "../../infrastructure/password-hasher.service";
import type { IUserRepository } from "../../domain/user.repository";
import type { IPasswordResetTokenRepository } from "../../domain/password-reset-token.repository";
import type { IPasswordResetNotifier, PasswordResetLink } from "../../domain/password-reset-notifier";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenRepo: IPasswordResetTokenRepository,
    private readonly notifier: IPasswordResetNotifier,
    private readonly appUrl: string = env.CORS_ORIGIN
  ) {}

  /**
   * El email es unico por empresa, no global. Antes se tomaba el primer usuario que apareciera con ese email, asi que a
   * quien estuviera en varias empresas le podia llegar el enlace de otra (2026-11-10). Ahora se genera un enlace por
   * cada empresa activa donde el email tiene un usuario activo, y todos van en UN solo correo con el nombre de cada
   * empresa. La pantalla no cambia y sigue sin revelar si el correo existe ni en que empresas esta: eso solo lo ve
   * quien abre el buzon. Las empresas archivadas se omiten (no se puede entrar a ellas).
   *
   * Siempre resuelve sin lanzar. Si el envio falla (ej. RESEND_API_KEY sin configurar) los tokens ya quedaron creados;
   * se loguea y no se propaga, mismo criterio que los notifiers de recordatorios.
   */
  async execute(email: string): Promise<void> {
    const companies = await this.userRepo.findCompaniesByEmail(email);
    const links: PasswordResetLink[] = [];
    let fullName = "";
    let userEmail = email;

    for (const company of companies) {
      const user = await this.userRepo.findByEmailWithAccess(company.companyId, email);
      if (!user || !user.isActive || !user.companyIsActive) continue;

      const rawToken = crypto.randomBytes(32).toString("hex");
      await this.tokenRepo.create(user.id, sha256(rawToken), new Date(Date.now() + TOKEN_TTL_MS));
      links.push({ companyName: company.companyName, resetUrl: `${this.appUrl}/reset-password?token=${rawToken}` });
      fullName ||= user.fullName;
      userEmail = user.email;
    }

    if (links.length === 0) return;
    try {
      await this.notifier.send({ email: userEmail, fullName, links });
    } catch (err) {
      console.error("No se pudo enviar el correo de reseteo de contraseña:", err);
    }
  }
}
