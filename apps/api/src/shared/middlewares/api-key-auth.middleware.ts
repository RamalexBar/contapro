import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { PrismaApiKeyRepository } from "../../modules/public-api/infrastructure/prisma-api-key.repository";
import { tenantStorage } from "../context/request-context";

// Instancia propia (sin estado, seguro instanciarla aparte del container del modulo dueño),
// mismo criterio ya documentado en suppliers.container.ts.
const apiKeyRepo = new PrismaApiKeyRepository();

/**
 * Autentica requests de la API publica (`/api/public/v1/*`) por API key en vez de JWT. Puebla
 * exactamente el mismo AsyncLocalStorage que tenantContextMiddleware (companyId/branchId/userId/
 * roles/permissions) -- los scopes de la key SE USAN como `permissions`, asi que
 * requirePermission() y todos los repositorios existentes funcionan sin ningun cambio. userId
 * sintetico `api:<id>` para distinguir en AuditLog/Sale.sellerUserId que la accion vino de una
 * integracion, no de un usuario real ni del poller ("system").
 */
export async function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "API_KEY_REQUIRED", message: "Falta el header Authorization: Bearer <api key>" });
  }

  const rawKey = header.slice(7);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const apiKey = await apiKeyRepo.findByHashCrossTenant(keyHash);

  if (!apiKey || !apiKey.isActive) {
    return res.status(401).json({ error: "INVALID_API_KEY", message: "API key invalida o revocada" });
  }

  await apiKeyRepo.touchLastUsed(apiKey.id);

  tenantStorage.run(
    {
      companyId: apiKey.companyId,
      branchId: null,
      userId: `api:${apiKey.id}`,
      roles: [],
      permissions: new Set(apiKey.scopes),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
    () => next()
  );
}
