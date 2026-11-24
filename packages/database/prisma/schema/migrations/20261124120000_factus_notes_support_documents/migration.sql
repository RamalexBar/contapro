-- Notas credito/debito y documento soporte por Factus (2026-11-24).
ALTER TABLE "credit_notes" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "credit_notes" ADD COLUMN "returnId" TEXT;
ALTER TABLE "credit_notes" ADD COLUMN "conceptCode" TEXT NOT NULL DEFAULT '1';
CREATE UNIQUE INDEX "credit_notes_returnId_key" ON "credit_notes"("returnId");

ALTER TABLE "debit_notes" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "debit_notes" ADD COLUMN "conceptCode" TEXT NOT NULL DEFAULT '4';

ALTER TABLE "electronic_credit_notes" ADD COLUMN "providerRequest" TEXT;
ALTER TABLE "electronic_debit_notes" ADD COLUMN "providerRequest" TEXT;
ALTER TABLE "electronic_support_documents" ADD COLUMN "providerRequest" TEXT;
