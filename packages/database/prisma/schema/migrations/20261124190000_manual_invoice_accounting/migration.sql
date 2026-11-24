-- Facturas manuales con comprobante contable y cuenta por cobrar (2026-11-24).
ALTER TABLE "accounts_receivable" ALTER COLUMN "saleId" DROP NOT NULL;
ALTER TABLE "accounts_receivable" ADD COLUMN "manualInvoiceId" TEXT;
CREATE UNIQUE INDEX "accounts_receivable_manualInvoiceId_key" ON "accounts_receivable"("manualInvoiceId");
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_manualInvoiceId_fkey" FOREIGN KEY ("manualInvoiceId") REFERENCES "manual_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "manual_invoices" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "manual_invoices" ADD COLUMN "journalEntryId" TEXT;

-- saleId opcional: misma regla de borrado que Prisma espera para una relacion opcional.
ALTER TABLE "accounts_receivable" DROP CONSTRAINT "accounts_receivable_saleId_fkey";
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
