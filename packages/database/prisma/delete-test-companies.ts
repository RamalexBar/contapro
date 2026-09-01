import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Borra por completo una o mas empresas de PRUEBA (compania + todo lo que cuelga de ella) de una
 * base de datos real. Hecho para correrse UNA vez a mano via el shell del proveedor de hosting,
 * mismo criterio que create-platform-admin.ts -- nunca se llama desde codigo de la app.
 *
 * SEGURO EXPLICITO: solo borra companias cuyo NIT este en ALLOWED_TEST_NITS -- si algun id que se
 * pase no corresponde a un NIT de esa lista, se aborta ANTES de borrar nada (ninguna compania se
 * toca a medias).
 *
 * El schema NO tiene onDelete: Cascade en ningun lado (deliberado, ver seed-base.ts / el resto del
 * schema), asi que el orden de borrado abajo importa. A diferencia de la version anterior de este
 * archivo (que mantenia el orden a mano y se quedo desactualizada -- broto un P2003 real contra
 * produccion en `payroll_deductions_employeeId_fkey` porque el modulo de nomina/tiempo se agrego
 * despues de escribirla), esta version se genero recorriendo TODO `prisma/schema/*.prisma`
 * programaticamente: se listaron las 114 tablas del esquema, se armo el grafo de dependencias real
 * (cada `@relation(fields: ...)`) y se calculo un orden topologico (hijas antes que padres). Cada
 * `deleteMany` de abajo usa un filtro de relacion anidado de Prisma (ej. `{ sale: { companyId } }`)
 * en vez de coleccionar ids de padres a mano -- asi una tabla nueva que se agregue en el futuro
 * mientras SI declare su `@relation` correctamente no puede romper este script en silencio.
 *
 * Excepcion: dos tablas (`AccountReceivableReminderLog.accountReceivableId` y
 * `SyncConflictLog.outboxEventId`) guardan el id del padre como String suelto, SIN `@relation`
 * declarado (no son FK reales en Postgres, a proposito) -- esas dos no se pueden filtrar por
 * relacion anidada, se resuelven con un array de ids collectado antes de la transaccion.
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
  "9001788189425", // Smoke Test 1788189425 -- confirmado con el usuario 2026-09-01
  "9001788266614", // Test DueDate 1788266614 -- confirmado con el usuario 2026-09-01
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
        // Las unicas dos tablas sin @relation real -- necesitan el array de ids del padre
        // recolectado ANTES de borrar nada (una vez que se borre AccountReceivable/SyncOutbox ya
        // no se puede volver a consultar cuales eran sus ids).
        const accountReceivableIds = (await tx.accountReceivable.findMany({ where: { companyId }, select: { id: true } })).map(
          (a) => a.id
        );
        const syncOutboxIds = (await tx.syncOutbox.findMany({ where: { companyId }, select: { id: true } })).map((s) => s.id);

        // ---- Orden topologico completo (hijas antes que padres), generado desde el esquema ----
        await tx.saleWithholding.deleteMany({ where: { sale: { companyId } } });
        await tx.purchaseWithholding.deleteMany({ where: { purchase: { companyId } } });
        await tx.withholdingConcept.deleteMany({ where: { companyId } });
        await tx.costCenter.deleteMany({ where: { companyId } });
        await tx.chartOfAccounts.deleteMany({ where: { companyId } }); // auto-referenciada, un solo deleteMany cubre el arbol
        await tx.journalEntryLine.deleteMany({ where: { journalEntry: { companyId } } });
        await tx.journalEntry.deleteMany({ where: { companyId } });
        await tx.financialPeriod.deleteMany({ where: { companyId } });
        await tx.bankTransaction.deleteMany({ where: { bankAccount: { companyId } } });
        await tx.bankReconciliationItem.deleteMany({ where: { reconciliation: { bankAccount: { companyId } } } });
        await tx.bankReconciliation.deleteMany({ where: { bankAccount: { companyId } } });
        await tx.bankAccount.deleteMany({ where: { companyId } });
        await tx.companyJournalEntryCounter.deleteMany({ where: { companyId } });
        await tx.userBranch.deleteMany({ where: { user: { companyId } } });
        await tx.userRole.deleteMany({ where: { user: { companyId } } });
        await tx.userPermission.deleteMany({ where: { user: { companyId } } });
        await tx.refreshToken.deleteMany({ where: { user: { companyId } } });
        await tx.passwordResetToken.deleteMany({ where: { user: { companyId } } });
        await tx.cashierDiscountLimit.deleteMany({ where: { companyId } });
        await tx.electronicPayroll.deleteMany({ where: { companyId } });
        await tx.payrollItem.deleteMany({ where: { payrollDetail: { payroll: { companyId } } } });
        await tx.payslipDocument.deleteMany({ where: { payrollDetail: { payroll: { companyId } } } });
        await tx.payrollDetail.deleteMany({ where: { payroll: { companyId } } });
        await tx.payrollDeduction.deleteMany({ where: { companyId } });
        await tx.timeEntry.deleteMany({ where: { employee: { companyId } } });
        await tx.vacation.deleteMany({ where: { employee: { companyId } } });
        await tx.leavePermission.deleteMany({ where: { employee: { companyId } } });
        await tx.absence.deleteMany({ where: { employee: { companyId } } });
        await tx.sickLeave.deleteMany({ where: { employee: { companyId } } });
        await tx.employee.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } });
        await tx.rolePermission.deleteMany({ where: { role: { companyId } } });
        await tx.role.deleteMany({ where: { companyId } });
        await tx.auditLog.deleteMany({ where: { companyId } });
        await tx.discountAuthorization.deleteMany({ where: { companyId } });
        await tx.cashMovement.deleteMany({ where: { cashSession: { companyId } } });
        await tx.cashCount.deleteMany({ where: { cashSession: { companyId } } });
        await tx.cashSession.deleteMany({ where: { companyId } });
        await tx.cashRegister.deleteMany({ where: { companyId } });
        await tx.accountReceivablePayment.deleteMany({ where: { accountReceivable: { companyId } } });
        await tx.accountReceivableReminderLog.deleteMany({ where: { accountReceivableId: { in: accountReceivableIds } } });
        await tx.accountReceivable.deleteMany({ where: { companyId } });
        await tx.salesCommissionScheme.deleteMany({ where: { companyId } });
        await tx.commissionSettlement.deleteMany({ where: { companyId } });
        await tx.opportunityItem.deleteMany({ where: { opportunity: { companyId } } });
        await tx.opportunity.deleteMany({ where: { companyId } });
        await tx.customerCreditMovement.deleteMany({ where: { customer: { companyId } } });
        await tx.customerPayment.deleteMany({ where: { customer: { companyId } } });
        await tx.customer.deleteMany({ where: { companyId } });
        await tx.electronicInvoice.deleteMany({ where: { companyId } });
        await tx.electronicCreditNote.deleteMany({ where: { companyId } });
        await tx.electronicDebitNote.deleteMany({ where: { companyId } });
        await tx.electronicSupportDocument.deleteMany({ where: { companyId } });
        await tx.invoiceNumberingResolution.deleteMany({ where: { companyId } });
        await tx.expense.deleteMany({ where: { companyId } });
        await tx.expenseCategory.deleteMany({ where: { companyId } });
        await tx.depreciationEntry.deleteMany({ where: { fixedAsset: { companyId } } });
        await tx.fixedAsset.deleteMany({ where: { companyId } });
        await tx.productImage.deleteMany({ where: { product: { companyId } } });
        await tx.barcode.deleteMany({ where: { companyId } });
        await tx.productPresentation.deleteMany({ where: { product: { companyId } } });
        await tx.productBranchStock.deleteMany({ where: { companyId } });
        await tx.batch.deleteMany({ where: { companyId } });
        await tx.stockMovement.deleteMany({ where: { companyId } });
        await tx.product.deleteMany({ where: { companyId } });
        await tx.category.deleteMany({ where: { companyId } });
        await tx.brand.deleteMany({ where: { companyId } });
        await tx.stockTransferItem.deleteMany({ where: { stockTransfer: { companyId } } });
        await tx.stockTransfer.deleteMany({ where: { companyId } });
        await tx.physicalInventoryItem.deleteMany({ where: { physicalInventory: { companyId } } });
        await tx.physicalInventory.deleteMany({ where: { companyId } });
        await tx.kardex.deleteMany({ where: { companyId } });
        await tx.payroll.deleteMany({ where: { companyId } });
        await tx.saleItem.deleteMany({ where: { sale: { companyId } } });
        await tx.salePayment.deleteMany({ where: { sale: { companyId } } });
        await tx.sale.deleteMany({ where: { companyId } });
        await tx.branchSaleCounter.deleteMany({ where: { companyId } });
        await tx.quoteItem.deleteMany({ where: { quote: { companyId } } });
        await tx.quote.deleteMany({ where: { companyId } });
        await tx.orderItem.deleteMany({ where: { order: { companyId } } });
        await tx.order.deleteMany({ where: { companyId } });
        await tx.returnItem.deleteMany({ where: { return: { companyId } } });
        await tx.return.deleteMany({ where: { companyId } });
        await tx.creditNote.deleteMany({ where: { companyId } });
        await tx.debitNote.deleteMany({ where: { companyId } });
        await tx.layawayItem.deleteMany({ where: { layaway: { companyId } } });
        await tx.layawayPayment.deleteMany({ where: { layaway: { companyId } } });
        await tx.layaway.deleteMany({ where: { companyId } });
        await tx.productPriceListEntry.deleteMany({ where: { priceList: { companyId } } });
        await tx.priceList.deleteMany({ where: { companyId } });
        await tx.apiKey.deleteMany({ where: { companyId } });
        await tx.webhookDelivery.deleteMany({ where: { webhookSubscription: { companyId } } });
        await tx.webhookSubscription.deleteMany({ where: { companyId } });
        await tx.recurringInvoiceItem.deleteMany({ where: { recurringInvoice: { companyId } } });
        await tx.recurringInvoiceRun.deleteMany({ where: { recurringInvoice: { companyId } } });
        await tx.recurringInvoice.deleteMany({ where: { companyId } });
        await tx.supplier.deleteMany({ where: { companyId } });
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId } } });
        await tx.purchaseOrder.deleteMany({ where: { companyId } });
        await tx.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { companyId } } });
        await tx.goodsReceipt.deleteMany({ where: { companyId } });
        await tx.supplierPayment.deleteMany({ where: { accountPayable: { companyId } } });
        await tx.accountPayable.deleteMany({ where: { companyId } });
        await tx.purchase.deleteMany({ where: { companyId } });
        await tx.syncDevice.deleteMany({ where: { companyId } });
        await tx.syncConflictLog.deleteMany({ where: { outboxEventId: { in: syncOutboxIds } } });
        await tx.syncOutbox.deleteMany({ where: { companyId } });
        await tx.branch.deleteMany({ where: { companyId } });
        await tx.subscriptionPayment.deleteMany({ where: { subscription: { companyId } } });
        await tx.subscriptionReminderLog.deleteMany({ where: { subscription: { companyId } } });
        await tx.subscription.deleteMany({ where: { companyId } });
        await tx.whatsAppDeliveryLog.deleteMany({ where: { companyId } });

        // ---- La compania misma, ya sin nada colgando ----
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
