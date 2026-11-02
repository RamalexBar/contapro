import { basePrisma } from "@erp/database";
import type { ILoginLinkRepository } from "../domain/login-link.repository";

/** basePrisma (sin extension de tenant): el enlace se usa ANTES de que exista sesion, como el de "olvide mi contrasena". */
export class PrismaLoginLinkRepository implements ILoginLinkRepository {
  async create(data: { userId: string; tokenHash: string; source: string; expiresAt: Date }): Promise<void> {
    await basePrisma.loginLink.create({ data });
  }

  async consume(tokenHash: string, now: Date) {
    const { count } = await basePrisma.loginLink.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count !== 1) return null;
    return basePrisma.loginLink.findUnique({ where: { tokenHash }, select: { userId: true, source: true } });
  }
}
