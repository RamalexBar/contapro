import type { NextFunction, Request, Response } from "express";
import { verifyPlatformAdminToken } from "../../modules/saas-admin/infrastructure/platform-admin-jwt.service";

/**
 * Analogo a tenant-context.middleware.ts, pero para el panel de administrador SaaS: NO usa
 * AsyncLocalStorage/tenant context (el panel es transversal a todas las empresas, no hay
 * companyId que inyectar) -- solo verifica el token de plataforma (secreto separado, ver
 * config/env.ts) y cuelga el id en `res.locals.platformAdminId` para que el controller lo lea.
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "TOKEN_REQUIRED", message: "Falta el header Authorization" });
    }

    const payload = verifyPlatformAdminToken(header.slice(7));
    res.locals.platformAdminId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Token invalido o expirado" });
  }
}
