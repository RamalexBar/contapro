import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Crea (o actualiza la contraseña de) un PlatformAdmin real -- pensado para correrse UNA vez
 * manualmente en produccion, via la shell que da el proveedor de hosting (ej. "Shell" de Render),
 * nunca commiteado con credenciales adentro como hace seed.ts con platform@demo.com/Demo1234!.
 *
 * Uso: pnpm --filter @erp/database exec tsx prisma/create-platform-admin.ts <email> <password> "<nombre completo>"
 */
async function main() {
  const [email, password, fullName] = process.argv.slice(2);
  if (!email || !password || !fullName) {
    console.error('Uso: tsx prisma/create-platform-admin.ts <email> <password> "<nombre completo>"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, passwordHash, fullName },
    update: { passwordHash, fullName },
  });

  console.log(`PlatformAdmin listo: ${admin.email} (${admin.fullName})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
