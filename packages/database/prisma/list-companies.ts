import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Solo lectura -- lista TODAS las empresas registradas (id, nombre, NIT, estado de suscripcion,
 * fecha de creacion) para identificar cuales son de prueba antes de borrarlas con
 * delete-test-companies.ts. No modifica nada.
 *
 * Uso: pnpm --filter @erp/database exec tsx prisma/list-companies.ts
 */
async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      nit: true,
      createdAt: true,
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, plan: { select: { code: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const c of companies) {
    const sub = c.subscriptions[0];
    console.log(`- ${c.name} (NIT ${c.nit})`);
    console.log(`    id: ${c.id}`);
    console.log(`    suscripcion: ${sub ? `${sub.status} (${sub.plan.code})` : "sin suscripcion"}`);
    console.log(`    creada: ${c.createdAt.toISOString()}\n`);
  }

  console.log(`Total: ${companies.length} empresas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
