import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../../modules/auth/infrastructure/jwt.service";
import { tenantStorage } from "../context/request-context";

/**
 * Verifica el JWT de acceso y llena el AsyncLocalStorage con el contexto de la request
 * (companyId, branchId, userId, roles, permissions). Toda ruta protegida debe pasar por aqui
 * ANTES de `requirePermission` o de cualquier repositorio Prisma (que depende del contexto
 * para el aislamiento multi-tenant, ver shared/prisma/tenant.extension.ts).
 *
 * La sucursal activa puede sobreescribirse por request con el header `x-branch-id`
 * (para usuarios con acceso a mas de una sucursal).
 */
export function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "TOKEN_REQUIRED", message: "Falta el header Authorization" });
    }

    const payload = verifyAccessToken(header.slice(7));
    const branchHeader = req.headers["x-branch-id"];

    tenantStorage.run(
      {
        companyId: payload.companyId,
        branchId: (typeof branchHeader === "string" ? branchHeader : undefined) ?? payload.branchId ?? null,
        userId: payload.sub,
        roles: payload.roles,
        permissions: new Set(payload.permissions),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
      () => next()
    );
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Token invalido o expirado" });
  }
}
