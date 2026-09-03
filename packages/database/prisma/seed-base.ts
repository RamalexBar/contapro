import type { Prisma } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from "@erp/shared-types";
import { seedDefaultWithholdingConcepts } from "../src/seed-withholding-concepts";
import { seedDefaultExpenseCategories } from "../src/seed-expense-categories";
import { seedDefaultChartOfAccounts } from "../src/seed-chart-of-accounts";

/**
 * Precios reales de mercado investigados en 2026-08 contra Siigo/Alegra/World Office/Loggro (ver
 * docs/PRECIOS.md): todo incluido, sin modulos separados -- ese es el diferencial contra la
 * competencia, que factura POS/nomina/contabilidad como productos aparte. Por eso todos los
 * planes pagos habilitan el mismo set de "features"; lo que diferencia un plan de otro es
 * maxBranches/maxUsers, no funcionalidad bloqueada.
 */
const FULL_FEATURES = { pos: true, inventory: true, cash: true, payroll: true, accounting: true };

/**
 * Siembra SOLO datos de infraestructura, sin ninguna empresa/usuario/contraseña de ejemplo --
 * seguro para correr contra una base de datos de PRODUCCION real (`pnpm db:seed:production`).
 * `seed.ts` (desarrollo/demo) llama a esta misma funcion y despues agrega la empresa demo encima.
 *
 * Sin esto, el registro publico de una empresa nueva (`RegisterCompanyUseCase`) no puede
 * funcionar: busca el plan `TRIAL` por code y los roles de sistema (ADMINISTRADOR/CAJERO/etc.)
 * tienen que existir de antemano (companyId: null, compartidos entre todas las empresas).
 */
export async function seedBase(prisma: Prisma.TransactionClient) {
  // ---- Catalogo de permisos ----
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: { module: permission.module, description: permission.description },
    });
  }

  // ---- Roles de sistema + sus permisos por defecto ----
  for (const roleName of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { name: roleName, companyId: null } });
    if (!role) {
      role = await prisma.role.create({ data: { name: roleName, isSystem: true, companyId: null } });
    }

    const permissionCodes = DEFAULT_ROLE_PERMISSIONS[roleName];
    const permissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  // ---- Planes (panel administrador SaaS) ----
  await prisma.plan.upsert({
    where: { code: "TRIAL" },
    create: { code: "TRIAL", name: "Prueba gratuita", priceMonthly: 0, priceYearly: 0, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
    // update completo (no {}): un re-seed debe poder corregir datos de planes ya creados, no solo
    // poblarlos la primera vez -- estos valores SI cambian con el tiempo (ajustes de precio).
    update: { name: "Prueba gratuita", priceMonthly: 0, priceYearly: 0, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "BASICO" },
    create: { code: "BASICO", name: "Plan Emprendedor", priceMonthly: 69900, priceYearly: 754900, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
    update: { name: "Plan Emprendedor", priceMonthly: 69900, priceYearly: 754900, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "PYME" },
    create: { code: "PYME", name: "Plan Pyme", priceMonthly: 149900, priceYearly: 1618900, maxBranches: 3, maxUsers: 10, features: FULL_FEATURES },
    update: { name: "Plan Pyme", priceMonthly: 149900, priceYearly: 1618900, maxBranches: 3, maxUsers: 10, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "PRO" },
    create: { code: "PRO", name: "Plan Plus", priceMonthly: 279900, priceYearly: 3022900, maxBranches: 10, maxUsers: 50, features: FULL_FEATURES },
    update: { name: "Plan Plus", priceMonthly: 279900, priceYearly: 3022900, maxBranches: 10, maxUsers: 50, features: FULL_FEATURES },
  });

  // ---- Planes "Solo Facturacion" (2026-09-03) ----
  // Linea de precio nueva y aparte de los 4 planes de arriba (que NO se tocaron) -- calcada tal
  // cual de la escalera real de Alegra "Solo Facturacion" (alegra.com/colombia/facturacion-electronica/precios,
  // verificado en vivo con el navegador el 2026-09-03: mismos 4 nombres de tier, mismo precio
  // mensual, mismo 25% de descuento anual -- ver docs/PRECIOS.md). features sigue siendo
  // FULL_FEATURES, no un set reducido: la empresa que solo necesita facturar no queda bloqueada de
  // usar POS/inventario si alguna vez lo necesita, y la factura manual sin venta
  // (modules/manual-invoicing) ya esta disponible para CUALQUIER plan, no solo para estos --
  // decision explicita del usuario. Lo unico que diferencia esta linea de la de arriba es el
  // precio y maxUsers (maxBranches queda en 1 en los 4 tiers, igual que Alegra no menciona
  // sucursales en esta linea -- pensada para una sola sede).
  await prisma.plan.upsert({
    where: { code: "FACT_EMPRENDEDOR" },
    create: { code: "FACT_EMPRENDEDOR", name: "Solo Facturacion Emprendedor", priceMonthly: 17900, priceYearly: 161100, maxBranches: 1, maxUsers: 1, features: FULL_FEATURES },
    update: { name: "Solo Facturacion Emprendedor", priceMonthly: 17900, priceYearly: 161100, maxBranches: 1, maxUsers: 1, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "FACT_PYME" },
    create: { code: "FACT_PYME", name: "Solo Facturacion Pyme", priceMonthly: 49900, priceYearly: 449100, maxBranches: 1, maxUsers: 2, features: FULL_FEATURES },
    update: { name: "Solo Facturacion Pyme", priceMonthly: 49900, priceYearly: 449100, maxBranches: 1, maxUsers: 2, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "FACT_PRO" },
    create: { code: "FACT_PRO", name: "Solo Facturacion Pro", priceMonthly: 99900, priceYearly: 899100, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
    update: { name: "Solo Facturacion Pro", priceMonthly: 99900, priceYearly: 899100, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "FACT_PLUS" },
    create: { code: "FACT_PLUS", name: "Solo Facturacion Plus", priceMonthly: 179900, priceYearly: 1619100, maxBranches: 1, maxUsers: 5, features: FULL_FEATURES },
    update: { name: "Solo Facturacion Plus", priceMonthly: 179900, priceYearly: 1619100, maxBranches: 1, maxUsers: 5, features: FULL_FEATURES },
  });

  // ---- Backfill de conceptos de retencion / categorias de gasto / plan de cuentas para empresas
  // que ya existian antes de estos items (empresas nuevas los reciben directo en
  // RegisterCompanyUseCase, sin esperar a un re-seed) ----
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    await seedDefaultWithholdingConcepts(prisma, company.id);
    await seedDefaultExpenseCategories(prisma, company.id);
    await seedDefaultChartOfAccounts(prisma, company.id);
  }
}
