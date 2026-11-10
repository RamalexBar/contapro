/**
 * Regulariza la cuenta 1435 de TODAS las empresas contra su inventario valorizado real (una sola vez tras el costeo
 * PEPS del 2026-11-10; ver modules/accounting/README.md, "Asientos de inventario y regularizacion de la 1435").
 *
 *   pnpm --filter @erp/api exec tsx src/scripts/regularize-inventory-account.ts           # solo muestra diferencias
 *   pnpm --filter @erp/api exec tsx src/scripts/regularize-inventory-account.ts --apply   # registra los asientos
 *
 * Idempotente: una empresa que ya cuadra (diferencia 0) no recibe asiento, asi que correrlo dos veces no duplica nada.
 * El comprobante queda a nombre del usuario mas antiguo de cada empresa (normalmente su administrador).
 */
// Cliente sin la extension de tenant: el script recorre todas las empresas antes de entrar al contexto de cada una.
import { basePrisma as prisma } from "@erp/database";
import { tenantStorage } from "../shared/context/request-context";
import { regularizeInventoryAccountUseCase } from "../modules/accounting/accounting.container";

async function main() {
  const apply = process.argv.includes("--apply");
  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  console.log(`${apply ? "APLICANDO" : "SIMULACION (usa --apply para registrar)"} -- ${companies.length} empresa(s)\n`);

  let touched = 0;
  for (const company of companies) {
    const user = await prisma.user.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!user) continue;

    const result = await tenantStorage.run(
      { companyId: company.id, branchId: null, userId: user.id, roles: [], permissions: new Set() },
      () => regularizeInventoryAccountUseCase.execute({ apply })
    );
    if (Math.abs(result.difference) < 0.01 && Math.abs(result.ledgerBalance) < 0.01) continue;

    const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
    console.log(
      `${company.name}: 1435 = ${fmt(result.ledgerBalance)} | inventario real = ${fmt(result.inventoryValue)} | diferencia = ${fmt(result.difference)}` +
        (result.entry ? ` -> comprobante #${result.entry.number}` : "")
    );
    if (Math.abs(result.difference) >= 0.01) touched += 1;
  }

  console.log(`\n${touched} empresa(s) con diferencia${apply ? " regularizadas" : ""}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
