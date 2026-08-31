import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Borra por completo una o mas empresas de PRUEBA (compania + todo lo que cuelga de ella) de una
 * base de datos real. Hecho para correrse UNA vez a mano via el shell del proveedor de hosting,
 * mismo criterio que create-platform-admin.ts -- nunca se llama desde codigo de la app.
 *
 * SEGURO EXPLICITO: solo borra companias cuyo NIT este en ALLOWED_TEST_NITS -- si algun id que se
 * pase no corresponde a un NIT de esa lista, se aborta ANTES de borrar nada (ninguna compania se
 * toca a medias). Confirmado con el usuario cuales son de prueba antes de escribir esto -- ver
 * conversacion en la sesion que genero este archivo.
 *
 * El schema NO tiene onDelete: Cascade en ningun lado (deliberado, ver seed-base.ts / el resto del
 * schema), asi que el orden de borrado abajo importa: primero las tablas "hoja" que referencian un
 * id de otra tabla via una relacion real de Prisma (@relation con fields/references -- Postgres SI
 * pone una FK real ahi), despues las que tienen companyId directo. Las referencias sueltas sin
 * @relation declarado (ej. Sale.customerId, JournalEntryLine.accountId) NO son FKs reales en la
 * base -- no bloquean el orden, se ignoran a proposito.
 *
 * Uso: pnpm --filter @erp/database exec tsx prisma/delete-test-companies.ts <companyId> [companyId...]
 */
const ALLOWED_TEST_NITS = new Set([
  "12345678", // pruebas
  "900999888-1", // Test QA
  "900999777-3", // Test Colision Email
  "900999999-1", // Empresa de Prueba Despliegue
  "900123457-2", // Contapro Demo
  "900123456-7", // Contapro Demo
]);

async function main() {
  const companyIds = process.argv.slice(2);
  if (companyIds.length === 0) {
    console.error("Uso: tsx prisma/delete-test-companies.ts <companyId> [companyId...]");
    process.exit(1);
  }

  // Validacion PRIMERO, fuera de la transaccion, antes de tocar nada -- si un solo id no matchea
  // la lista blanca, se aborta todo el batch completo (no borra "las que si son validas y deja el
  // resto" -- eso podria ocultar un error de tipeo en un id).
  const companies = await prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true, nit: true } });
  if (companies.length !== companyIds.length) {
    const found = new Set(companies.map((c) => c.id));
    const missing = companyIds.filter((id) => !found.has(id));
    console.error(`ABORTADO: estos ids no existen en la base: ${missing.join(", ")}`);
    process.exit(1);
  }
  const notAllowed = companies.filter((c) => !ALLOWED_TEST_NITS.has(c.nit));
  if (notAllowed.length > 0) {
    console.error("ABORTADO: estas companias NO estan en la lista blanca de NITs de prueba, no se borro nada:");
    for (const c of notAllowed) console.error(`  ${c.name} (NIT ${c.nit}, id ${c.id})`);
    process.exit(1);
  }

  console.log("Companias a borrar (verificadas contra la lista blanca de NITs):");
  for (const c of companies) console.log(`  ${c.name} (NIT ${c.nit}, id ${c.id})`);

  for (const companyId of companyIds) {
    await prisma.$transaction(
      async (tx) => {
        const saleIds = (await tx.sale.findMany({ where: { companyId }, select: { id: true } })).map((s) => s.id);
        const quoteIds = (await tx.quote.findMany({ where: { companyId }, select: { id: true } })).map((q) => q.id);
        const journalEntryIds = (await tx.journalEntry.findMany({ where: { companyId }, select: { id: true } })).map((j) => j.id);
        const productIds = (await tx.product.findMany({ where: { companyId }, select: { id: true } })).map((p) => p.id);
        const purchaseIds = (await tx.purchase.findMany({ where: { companyId }, select: { id: true } })).map((p) => p.id);
        const customerIds = (await tx.customer.findMany({ where: { companyId }, select: { id: true } })).map((c) => c.id);
        const userIds = (await tx.user.findMany({ where: { companyId }, select: { id: true } })).map((u) => u.id);
        const accountReceivableIds = (await tx.accountReceivable.findMany({ where: { companyId }, select: { id: true } })).map((a) => a.id);
        const accountPayableIds = (await tx.accountPayable.findMany({ where: { companyId }, select: { id: true } })).map((a) => a.id);
        const subscriptionIds = (await tx.subscription.findMany({ where: { companyId }, select: { id: true } })).map((s) => s.id);

        // ---- Fase 1: tablas hoja, referencian un id de otra tabla via @relation real (no tienen
        // companyId propio, hay que resolverlas por el id del padre) ----
        await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.saleWithholding.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: { in: journalEntryIds } } });
        await tx.productImage.deleteMany({ where: { productId: { in: productIds } } });
        await tx.productPresentation.deleteMany({ where: { productId: { in: productIds } } });
        await tx.purchaseWithholding.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
        await tx.customerCreditMovement.deleteMany({ where: { customerId: { in: customerIds } } });
        await tx.customerPayment.deleteMany({ where: { customerId: { in: customerIds } } });
        await tx.userBranch.deleteMany({ where: { userId: { in: userIds } } });
        await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
        await tx.userPermission.deleteMany({ where: { userId: { in: userIds } } });
        await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
        await tx.accountReceivablePayment.deleteMany({ where: { accountReceivableId: { in: accountReceivableIds } } });
        await tx.accountReceivableReminderLog.deleteMany({ where: { accountReceivableId: { in: accountReceivableIds } } });
        await tx.supplierPayment.deleteMany({ where: { accountPayableId: { in: accountPayableIds } } });
        await tx.subscriptionPayment.deleteMany({ where: { subscriptionId: { in: subscriptionIds } } });
        await tx.subscriptionReminderLog.deleteMany({ where: { subscriptionId: { in: subscriptionIds } } });

        // ---- Fase 2: tienen companyId propio, pero dependen de que la fase 1 ya haya limpiado
        // sus hijos (o dependen de otra tabla de esta misma fase, ya anotado en cada linea) ----
        await tx.accountReceivable.deleteMany({ where: { companyId } });
        await tx.accountPayable.deleteMany({ where: { companyId } });
        await tx.sale.deleteMany({ where: { companyId } });
        await tx.quote.deleteMany({ where: { companyId } });
        await tx.creditNote.deleteMany({ where: { companyId } });
        await tx.debitNote.deleteMany({ where: { companyId } });
        await tx.purchase.deleteMany({ where: { companyId } });
        await tx.journalEntry.deleteMany({ where: { companyId } });
        await tx.barcode.deleteMany({ where: { companyId } });
        await tx.productBranchStock.deleteMany({ where: { companyId } });
        await tx.batch.deleteMany({ where: { companyId } });
        await tx.stockMovement.deleteMany({ where: { companyId } });
        await tx.kardex.deleteMany({ where: { companyId } });
        await tx.product.deleteMany({ where: { companyId } }); // despues de barcode/stock/batch/kardex/images/presentations
        await tx.category.deleteMany({ where: { companyId } }); // despues de product (Product.category es FK real)
        await tx.brand.deleteMany({ where: { companyId } }); // despues de product (Product.brand es FK real)
        await tx.customer.deleteMany({ where: { companyId } });
        await tx.supplier.deleteMany({ where: { companyId } });
        await tx.expense.deleteMany({ where: { companyId } });
        await tx.expenseCategory.deleteMany({ where: { companyId } }); // despues de expense
        await tx.withholdingConcept.deleteMany({ where: { companyId } });
        await tx.cashierDiscountLimit.deleteMany({ where: { companyId } });
        await tx.discountAuthorization.deleteMany({ where: { companyId } });
        await tx.auditLog.deleteMany({ where: { companyId } });
        await tx.cashRegister.deleteMany({ where: { companyId } });
        await tx.chartOfAccounts.deleteMany({ where: { companyId } }); // auto-referenciada, un solo deleteMany cubre el arbol
        await tx.branchSaleCounter.deleteMany({ where: { companyId } });
        await tx.companyJournalEntryCounter.deleteMany({ where: { companyId } });
        await tx.subscription.deleteMany({ where: { companyId } }); // despues de subscriptionPayment/reminderLog
        await tx.rolePermission.deleteMany({ where: { role: { companyId } } });
        await tx.role.deleteMany({ where: { companyId } });
        await tx.employee.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } }); // despues de userBranch/userRole/userPermission/refreshToken/passwordResetToken/cashierDiscountLimit/employee
        await tx.branch.deleteMany({ where: { companyId } }); // despues de userBranch

        // ---- Fase 3: la compania misma, ya sin nada colgando ----
        await tx.company.delete({ where: { id: companyId } });
      },
      { timeout: 60_000 }
    );
    console.log(`Borrada: ${companyId}`);
  }

  console.log("Listo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
