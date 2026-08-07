import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Resetea la contrasena de un usuario de una empresa (no PlatformAdmin) por email -- pensado
 * para correrse UNA vez manualmente en produccion via la shell del proveedor de hosting (ej.
 * "Shell" de Render), para el caso de "me registre y perdi la contrasena y no hay flujo de
 * recuperacion todavia" (ver create-platform-admin.ts, mismo patron para el otro tipo de cuenta).
 *
 * Uso: pnpm --filter @erp/database exec tsx prisma/reset-user-password.ts <email> <password-nueva>
 */
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Uso: tsx prisma/reset-user-password.ts <email> <password-nueva>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const matches = await prisma.user.findMany({ where: { email }, include: { company: true } });
  if (matches.length === 0) {
    console.error(`No existe ningun usuario con el correo ${email}.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Hay ${matches.length} usuarios con ese correo en distintas empresas, no se puede resetear sin ambiguedad:`);
    for (const m of matches) console.error(`  - userId=${m.id} empresa="${m.company.name}" (companyId=${m.companyId})`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id: matches[0].id }, data: { passwordHash } });

  console.log(`Contraseña actualizada para ${user.email} (${user.fullName}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
