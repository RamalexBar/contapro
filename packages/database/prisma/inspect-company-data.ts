import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Solo lectura -- cuenta cuantas filas tiene cada empresa en cada tabla que tiene companyId, para
 * decidir con datos reales (no adivinando) que se necesita borrar antes de eliminar una empresa de
 * prueba. No borra nada. Ver limpieza real en delete-companies.ts (una vez se sepa el alcance).
 *
 * Uso: pnpm --filter @erp/database exec tsx prisma/inspect-company-data.ts <companyId> [companyId...]
 */
const COMPANY_SCOPED_MODELS = [
  "accountPayable",
  "accountReceivable",
  "apiKey",
  "auditLog",
  "bankAccount",
  "barcode",
  "batch",
  "branch",
  "branchSaleCounter",
  "brand",
  "cashRegister",
  "cashSession",
  "cashierDiscountLimit",
  "category",
  "chartOfAccounts",
  "commissionSettlement",
  "companyJournalEntryCounter",
  "costCenter",
  "creditNote",
  "customer",
  "debitNote",
  "discountAuthorization",
  "electronicCreditNote",
  "electronicDebitNote",
  "electronicInvoice",
  "electronicPayroll",
  "electronicSupportDocument",
  "employee",
  "expense",
  "expenseCategory",
  "financialPeriod",
  "fixedAsset",
  "goodsReceipt",
  "invoiceNumberingResolution",
  "journalEntry",
  "kardex",
  "layaway",
  "opportunity",
  "order",
  "payroll",
  "payrollDeduction",
  "physicalInventory",
  "priceList",
  "product",
  "productBranchStock",
  "purchase",
  "purchaseOrder",
  "quote",
  "recurringInvoice",
  "return",
  "role",
  "sale",
  "salesCommissionScheme",
  "stockMovement",
  "stockTransfer",
  "subscription",
  "supplier",
  "syncDevice",
  "syncOutbox",
  "user",
  "webhookSubscription",
  "whatsAppDeliveryLog",
  "withholdingConcept",
] as const;

async function main() {
  const companyIds = process.argv.slice(2);
  if (companyIds.length === 0) {
    console.error("Uso: tsx prisma/inspect-company-data.ts <companyId> [companyId...]");
    process.exit(1);
  }

  for (const companyId of companyIds) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, nit: true } });
    console.log(`\n=== ${company?.name ?? "(no encontrada)"} (${company?.nit ?? "?"}) -- ${companyId} ===`);
    let totalRows = 0;
    for (const model of COMPANY_SCOPED_MODELS) {
      // @ts-expect-error -- acceso dinamico al cliente de Prisma por nombre de modelo (string), no
      // hay forma de tipar esto sin repetir la lista 62 veces a mano.
      const count = await prisma[model].count({ where: { companyId } });
      if (count > 0) {
        console.log(`  ${model}: ${count}`);
        totalRows += count;
      }
    }
    console.log(`  TOTAL: ${totalRows} filas`);
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
