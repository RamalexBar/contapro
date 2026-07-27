import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __erpPrismaClient: PrismaClient | undefined;
}

/**
 * Cliente Prisma "base" (sin la extension de tenant). apps/api lo envuelve con
 * `tenantExtension` (ver apps/api/src/shared/prisma/tenant.extension.ts) antes de usarlo
 * en cualquier caso de uso. Nunca importar este singleton directamente desde un modulo de
 * negocio: siempre a traves de `apps/api/src/shared/prisma/prisma-client.ts`.
 */
export const basePrisma =
  globalThis.__erpPrismaClient ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__erpPrismaClient = basePrisma;
}
