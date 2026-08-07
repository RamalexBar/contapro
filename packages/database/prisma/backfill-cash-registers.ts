import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Backfill para companias registradas ANTES de que RegisterCompanyUseCase creara una CashRegister
 * por defecto (ver prisma-user.repository.ts) -- hasta ese fix, ninguna empresa nueva podia abrir
 * caja porque no existia ningun flujo (UI ni script) para crear una CashRegister; la unica que
 * tenia una era la demo, insertada a mano en algun momento del desarrollo.
 *
 * Idempotente: solo crea una caja para empresas que todavia no tengan NINGUNA (activa o no).
 *
 * Uso: pnpm --filter @erp/database exec tsx prisma/backfill-cash-registers.ts
 */
async function main() {
  const companies = await prisma.company.findMany({ include: { branches: { where: { isMain: true }, take: 1 } } });

  let created = 0;
  for (const company of companies) {
    const existing = await prisma.cashRegister.findFirst({ where: { companyId: company.id } });
    if (existing) continue;

    const mainBranch = company.branches[0];
    if (!mainBranch) {
      console.warn(`Empresa "${company.name}" (${company.id}) no tiene sucursal principal, se omite.`);
      continue;
    }

    await prisma.cashRegister.create({
      data: { companyId: company.id, branchId: mainBranch.id, code: "CAJA1", name: "Caja principal" },
    });
    console.log(`Caja creada para "${company.name}" (${company.id}).`);
    created++;
  }

  console.log(`Listo: ${created} empresa(s) actualizadas de ${companies.length} totales.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
