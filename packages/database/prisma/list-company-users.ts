import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Solo lectura -- lista los usuarios de una empresa (email, nombre, roles, permisos individuales)
 * para diagnosticar accesos perdidos/olvidados. No modifica nada. Paso previo a
 * reset-user-password.ts.
 *
 * Uso: pnpm --filter @erp/database exec tsx prisma/list-company-users.ts <companyId>
 */
async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error("Uso: tsx prisma/list-company-users.ts <companyId>");
    process.exit(1);
  }

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, nit: true } });
  if (!company) {
    console.error(`No existe ninguna empresa con id ${companyId}`);
    process.exit(1);
  }
  console.log(`Empresa: ${company.name} (NIT ${company.nit})\n`);

  const users = await prisma.user.findMany({
    where: { companyId },
    include: {
      roles: { include: { role: true } },
      permissions: { include: { permission: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const u of users) {
    const roleNames = u.roles.map((r) => r.role.name).join(", ") || "(sin rol)";
    const grants = u.permissions.map((p) => `${p.granted ? "+" : "-"}${p.permission.code}`).join(", ") || "(ninguno)";
    console.log(`- ${u.email} -- ${u.fullName} -- activo: ${u.isActive}`);
    console.log(`    rol(es): ${roleNames}`);
    console.log(`    permisos individuales: ${grants}`);
    console.log(`    id: ${u.id}\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
