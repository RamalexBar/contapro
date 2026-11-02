/** Enlace de entrada de un solo uso (boton "Entrar a Contapro" desde Cajapro). Se guarda solo el hash del token. */
export interface ILoginLinkRepository {
  create(data: { userId: string; tokenHash: string; source: string; expiresAt: Date }): Promise<void>;
  /** Lo marca usado y devuelve su usuario, solo si existe, no se habia usado y no vencio. Atomico: dos clics
   * al mismo enlace no abren dos sesiones. */
  consume(tokenHash: string, now: Date): Promise<{ userId: string; source: string } | null>;
}
