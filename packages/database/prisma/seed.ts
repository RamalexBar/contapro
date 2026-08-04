import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedBase } from "./seed-base";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo1234!";

/**
 * Seed de DESARROLLO/DEMO -- ademas de la infraestructura base (seedBase: permisos, roles,
 * planes), crea una empresa de ejemplo con usuarios de contraseña PUBLICA conocida
 * (Demo1234!) y un PlatformAdmin igual de publico. NUNCA correr esto contra una base de datos de
 * produccion real -- para produccion usar `pnpm db:seed:production` (packages/database/prisma/
 * seed-production.ts), que solo siembra seedBase.
 */
async function main() {
  console.log("Seed: creando empresa demo 'Minimarket La Esquina'...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const pinHash = await bcrypt.hash("1234", 10);

  await prisma.$transaction(async (tx) => {
    await seedBase(tx);
    const plan = await tx.plan.findUniqueOrThrow({ where: { code: "BASICO" } });

    // ---- Empresa + Sucursal ----

    const company = await tx.company.upsert({
      where: { nit: "900123456-7" },
      create: {
        name: "Minimarket La Esquina",
        legalName: "Minimarket La Esquina S.A.S.",
        nit: "900123456-7",
        email: "contacto@minimarketlaesquina.demo",
        phone: "3001234567",
      },
      update: {},
    });

    const branch = await tx.branch.upsert({
      where: { companyId_code: { companyId: company.id, code: "PRIN" } },
      create: {
        companyId: company.id,
        name: "Sucursal Principal",
        code: "PRIN",
        address: "Cra 10 # 20-30, Manizales",
        isMain: true,
      },
      update: {},
    });

    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const existingSubscription = await tx.subscription.findFirst({ where: { companyId: company.id } });
    if (!existingSubscription) {
      await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          startDate: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    // ---- Usuarios demo ----
    const adminRole = await tx.role.findFirstOrThrow({ where: { name: "ADMINISTRADOR", companyId: null } });
    const cajeroRole = await tx.role.findFirstOrThrow({ where: { name: "CAJERO", companyId: null } });

    const admin = await tx.user.upsert({
      where: { companyId_email: { companyId: company.id, email: "admin@demo.com" } },
      create: {
        companyId: company.id,
        email: "admin@demo.com",
        passwordHash,
        pinHash,
        fullName: "Admin Demo",
      },
      update: {},
    });
    await tx.userBranch.upsert({
      where: { userId_branchId: { userId: admin.id, branchId: branch.id } },
      create: { userId: admin.id, branchId: branch.id, isDefault: true },
      update: {},
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      create: { userId: admin.id, roleId: adminRole.id },
      update: {},
    });

    const cajero = await tx.user.upsert({
      where: { companyId_email: { companyId: company.id, email: "cajero@demo.com" } },
      create: {
        companyId: company.id,
        email: "cajero@demo.com",
        passwordHash,
        pinHash,
        fullName: "Cajero Demo",
      },
      update: {},
    });
    await tx.userBranch.upsert({
      where: { userId_branchId: { userId: cajero.id, branchId: branch.id } },
      create: { userId: cajero.id, branchId: branch.id, isDefault: true },
      update: {},
    });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: cajero.id, roleId: cajeroRole.id } },
      create: { userId: cajero.id, roleId: cajeroRole.id },
      update: {},
    });
    await tx.cashierDiscountLimit.upsert({
      where: { userId: cajero.id },
      create: { companyId: company.id, userId: cajero.id, maxDiscountPercent: 5 },
      update: { maxDiscountPercent: 5 },
    });

    // ---- Inventario demo ----
    let category = await tx.category.findFirst({
      where: { companyId: company.id, name: "Abarrotes", parentId: null },
    });
    if (!category) {
      category = await tx.category.create({ data: { companyId: company.id, name: "Abarrotes" } });
    }
    const brand = await tx.brand.upsert({
      where: { companyId_name: { companyId: company.id, name: "Diana" } },
      create: { companyId: company.id, name: "Diana" },
      update: {},
    });

    const demoProducts = [
      { sku: "ARR-001", name: "Arroz Diana 500g", cost: 2800, price: 3500, barcode: "7702001001001" },
      { sku: "ACE-001", name: "Aceite Girasol 1L", cost: 8500, price: 11000, barcode: "7702001001002" },
      { sku: "PAN-001", name: "Pan Tajado Bimbo", cost: 4200, price: 5500, barcode: "7702001001003" },
      { sku: "LEC-001", name: "Leche Entera 1L", cost: 3100, price: 4200, barcode: "7702001001004" },
      { sku: "AZU-001", name: "Azucar Blanca 1kg", cost: 2600, price: 3400, barcode: "7702001001005" },
    ];

    for (const p of demoProducts) {
      const product = await tx.product.upsert({
        where: { companyId_sku: { companyId: company.id, sku: p.sku } },
        create: {
          companyId: company.id,
          sku: p.sku,
          name: p.name,
          categoryId: category.id,
          brandId: brand.id,
          currentCost: p.cost,
          currentPrice: p.price,
        },
        update: {},
      });
      await tx.barcode.upsert({
        where: { companyId_code: { companyId: company.id, code: p.barcode } },
        create: { companyId: company.id, productId: product.id, code: p.barcode },
        update: {},
      });
      await tx.productBranchStock.upsert({
        where: { productId_branchId: { productId: product.id, branchId: branch.id } },
        create: {
          companyId: company.id,
          productId: product.id,
          branchId: branch.id,
          quantity: 100,
          minStock: 10,
          maxStock: 300,
        },
        update: {},
      });
    }

    // ---- Caja registradora ----
    await tx.cashRegister.upsert({
      where: { branchId_code: { branchId: branch.id, code: "CAJA-1" } },
      create: { companyId: company.id, branchId: branch.id, code: "CAJA-1", name: "Caja Principal" },
      update: {},
    });

    // ---- Empleados demo (para Nomina) ----
    // Empleado 1: salario <= 2 SMLV de ejemplo -> SI tiene derecho a auxilio de transporte.
    await tx.employee.upsert({
      where: { companyId_documentNumber: { companyId: company.id, documentNumber: "1023456789" } },
      create: {
        companyId: company.id,
        branchId: branch.id,
        documentType: "CC",
        documentNumber: "1023456789",
        firstName: "Laura",
        lastName: "Gomez",
        position: "Auxiliar de bodega",
        contractType: "INDEFINITE",
        baseSalary: 1400000,
        hireDate: new Date("2024-02-01"),
        eps: "Sura EPS",
        arlRiskLevel: "I",
        pensionFund: "Porvenir",
        compensationFund: "Comfamiliar",
      },
      update: {},
    });

    // Empleado 2: salario > 2 SMLV de ejemplo -> NO tiene derecho a auxilio de transporte.
    await tx.employee.upsert({
      where: { companyId_documentNumber: { companyId: company.id, documentNumber: "1034567890" } },
      create: {
        companyId: company.id,
        branchId: branch.id,
        documentType: "CC",
        documentNumber: "1034567890",
        firstName: "Carlos",
        lastName: "Restrepo",
        position: "Supervisor de tienda",
        contractType: "INDEFINITE",
        baseSalary: 3500000,
        hireDate: new Date("2023-06-15"),
        eps: "Sura EPS",
        arlRiskLevel: "I",
        pensionFund: "Porvenir",
        compensationFund: "Comfamiliar",
      },
      update: {},
    });

    // ---- Parametros legales de nomina 2026 ----
    // IMPORTANTE: estos son valores de EJEMPLO para poder probar el motor de calculo end-to-end.
    // NO son cifras oficiales del DIAN/Mintrabajo -- verificalas contra la legislacion vigente
    // antes de liquidar nomina real. Ver docs/ALCANCE.md y modules/payroll/README.md.
    await tx.payrollParameter.upsert({
      where: { year: 2026 },
      create: {
        year: 2026,
        effectiveFrom: new Date("2026-01-01"),
        minimumWage: 1400000,
        transportAllowance: 200000,
        uvt: 49000,
        healthEmployeePercent: 4,
        healthEmployerPercent: 8.5,
        pensionEmployeePercent: 4,
        pensionEmployerPercent: 12,
        arlPercentByRiskLevel: { I: 0.522, II: 1.044, III: 2.436, IV: 4.35, V: 6.96 },
        severancePercent: 8.33,
        severanceInterestPercent: 12,
        serviceBonusPercent: 8.33,
        vacationPercent: 4.17,
        familyCompensationPercent: 4,
        icbfPercent: 3,
        senaPercent: 2,
        overtimeDayPercent: 25,
        overtimeNightPercent: 75,
        nightSurchargePercent: 35,
        sundayHolidaySurchargePercent: 75,
        monthlyHoursDivisor: 220,
      },
      update: {},
    });

    // ---- Administrador de plataforma (panel SaaS, autenticacion separada de User) ----
    await tx.platformAdmin.upsert({
      where: { email: "platform@demo.com" },
      create: {
        email: "platform@demo.com",
        passwordHash,
        fullName: "Operador Plataforma",
      },
      update: {},
    });
  });

  console.log("Seed completado.");
  console.log(`  Admin  -> admin@demo.com / ${DEMO_PASSWORD}`);
  console.log(`  Cajero -> cajero@demo.com / ${DEMO_PASSWORD} (limite descuento 5%, PIN 1234)`);
  console.log(`  Platform admin -> platform@demo.com / ${DEMO_PASSWORD} (POST /api/admin/auth/login)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
