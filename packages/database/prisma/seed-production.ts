import { PrismaClient } from "@prisma/client";
import { seedBase } from "./seed-base";

const prisma = new PrismaClient();

/**
 * Seed de PRODUCCION real -- solo infraestructura (permisos, roles de sistema, planes de
 * suscripcion). A proposito NO crea ninguna empresa/usuario/contraseña de ejemplo (a diferencia
 * de seed.ts, pensado para desarrollo/demo con Demo1234! como password publica conocida). Correr
 * UNA vez despues del primer deploy: `pnpm --filter @erp/database run db:seed:production`.
 *
 * Despues de esto, el primer PlatformAdmin real se crea con create-platform-admin.ts (no queda
 * ninguna cuenta de plataforma con contraseña conocida por defecto), y las empresas se dan de
 * alta solas via POST /auth/register-company (pantalla de registro publica).
 */
async function main() {
  console.log("Seed de produccion: sembrando permisos, roles y planes...");
  // timeout explicito: seedBase() hace backfill sobre TODAS las empresas existentes (ver el
  // mismo ajuste en seed.ts), el default de Prisma (5000ms) no alcanza mas alla de un puñado.
  await prisma.$transaction(async (tx) => {
    await seedBase(tx);
  }, { timeout: 300_000 });
  console.log("Listo. Siguiente paso: crear el primer PlatformAdmin con create-platform-admin.ts");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
