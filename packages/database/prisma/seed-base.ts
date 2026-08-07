import type { Prisma } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from "@erp/shared-types";
import { seedDefaultWithholdingConcepts } from "../src/seed-withholding-concepts";
import { seedDefaultExpenseCategories } from "../src/seed-expense-categories";

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
    create: { code: "BASICO", name: "Plan Emprendedor", priceMonthly: 39900, priceYearly: 430900, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
    update: { name: "Plan Emprendedor", priceMonthly: 39900, priceYearly: 430900, maxBranches: 1, maxUsers: 3, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "PYME" },
    create: { code: "PYME", name: "Plan Pyme", priceMonthly: 79900, priceYearly: 862900, maxBranches: 3, maxUsers: 10, features: FULL_FEATURES },
    update: { name: "Plan Pyme", priceMonthly: 79900, priceYearly: 862900, maxBranches: 3, maxUsers: 10, features: FULL_FEATURES },
  });
  await prisma.plan.upsert({
    where: { code: "PRO" },
    create: { code: "PRO", name: "Plan Plus", priceMonthly: 149900, priceYearly: 1618900, maxBranches: 10, maxUsers: 50, features: FULL_FEATURES },
    update: { name: "Plan Plus", priceMonthly: 149900, priceYearly: 1618900, maxBranches: 10, maxUsers: 50, features: FULL_FEATURES },
  });

  // ---- Backfill de conceptos de retencion / categorias de gasto para empresas que ya existian
  // antes de estos items (empresas nuevas los reciben directo en RegisterCompanyUseCase, sin
  // esperar a un re-seed) ----
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    await seedDefaultWithholdingConcepts(prisma, company.id);
    await seedDefaultExpenseCategories(prisma, company.id);
  }
}
