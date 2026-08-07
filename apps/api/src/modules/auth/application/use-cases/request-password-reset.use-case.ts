import crypto from "node:crypto";
import { env } from "../../../../config/env";
import { sha256 } from "../../infrastructure/password-hasher.service";
import type { IUserRepository } from "../../domain/user.repository";
import type { IPasswordResetTokenRepository } from "../../domain/password-reset-token.repository";
import type { IPasswordResetNotifier } from "../../domain/password-reset-notifier";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenRepo: IPasswordResetTokenRepository,
    private readonly notifier: IPasswordResetNotifier
  ) {}

  /** Siempre resuelve sin lanzar (el controller responde el mismo mensaje generico exista o no
   * el correo, para no filtrar que correos estan registrados). Si el envio de Resend falla (ej.
   * RESEND_API_KEY sin configurar), el token ya quedo creado pero no se pudo avisar -- se loguea
   * y no se propaga, mismo criterio que los notifiers de recordatorios (IReminderNotifier). */
  async execute(email: string): Promise<void> {
    const user = await this.userRepo.findByEmailWithAccess(undefined, email);
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await this.tokenRepo.create(user.id, tokenHash, expiresAt);

    const resetUrl = `${env.CORS_ORIGIN}/reset-password?token=${rawToken}`;
    try {
      await this.notifier.send({ email: user.email, fullName: user.fullName, resetUrl });
    } catch (err) {
      console.error("No se pudo enviar el correo de reseteo de contraseña:", err);
    }
  }
}
