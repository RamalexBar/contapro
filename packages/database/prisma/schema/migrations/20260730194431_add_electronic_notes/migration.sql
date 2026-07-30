-- CreateEnum
CREATE TYPE "DianDocumentType" AS ENUM ('FACTURA_VENTA', 'NOTA_CREDITO', 'NOTA_DEBITO');

-- DropIndex
DROP INDEX "invoice_numbering_resolutions_companyId_branchId_isActive_idx";

-- DropIndex
DROP INDEX "invoice_numbering_resolutions_companyId_prefix_key";

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "cude" TEXT,
ADD COLUMN     "xmlUrl" TEXT;

-- AlterTable
ALTER TABLE "debit_notes" ADD COLUMN     "cude" TEXT,
ADD COLUMN     "xmlUrl" TEXT;

-- AlterTable
ALTER TABLE "invoice_numbering_resolutions" ADD COLUMN     "documentType" "DianDocumentType" NOT NULL DEFAULT 'FACTURA_VENTA';

-- CreateTable
CREATE TABLE "electronic_credit_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "numberingResolutionId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "cude" TEXT NOT NULL,
    "referenceCufe" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "customerDocumentType" TEXT NOT NULL,
    "customerDocumentNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "environment" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "status" "ElectronicInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedXmlContent" TEXT,
    "dianTrackingId" TEXT,
    "dianResponseXml" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "electronic_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electronic_debit_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "numberingResolutionId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "cude" TEXT NOT NULL,
    "referenceCufe" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "customerDocumentType" TEXT NOT NULL,
    "customerDocumentNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "environment" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "status" "ElectronicInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedXmlContent" TEXT,
    "dianTrackingId" TEXT,
    "dianResponseXml" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "electronic_debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "electronic_credit_notes_creditNoteId_key" ON "electronic_credit_notes"("creditNoteId");

-- CreateIndex
CREATE INDEX "electronic_credit_notes_companyId_branchId_createdAt_idx" ON "electronic_credit_notes"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "electronic_credit_notes_companyId_status_idx" ON "electronic_credit_notes"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_credit_notes_companyId_prefix_number_key" ON "electronic_credit_notes"("companyId", "prefix", "number");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_debit_notes_debitNoteId_key" ON "electronic_debit_notes"("debitNoteId");

-- CreateIndex
CREATE INDEX "electronic_debit_notes_companyId_branchId_createdAt_idx" ON "electronic_debit_notes"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "electronic_debit_notes_companyId_status_idx" ON "electronic_debit_notes"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_debit_notes_companyId_prefix_number_key" ON "electronic_debit_notes"("companyId", "prefix", "number");

-- CreateIndex
CREATE INDEX "invoice_numbering_resolutions_companyId_branchId_documentTy_idx" ON "invoice_numbering_resolutions"("companyId", "branchId", "documentType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_numbering_resolutions_companyId_documentType_prefix_key" ON "invoice_numbering_resolutions"("companyId", "documentType", "prefix");

-- AddForeignKey
ALTER TABLE "electronic_credit_notes" ADD CONSTRAINT "electronic_credit_notes_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_credit_notes" ADD CONSTRAINT "electronic_credit_notes_numberingResolutionId_fkey" FOREIGN KEY ("numberingResolutionId") REFERENCES "invoice_numbering_resolutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_debit_notes" ADD CONSTRAINT "electronic_debit_notes_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_debit_notes" ADD CONSTRAINT "electronic_debit_notes_numberingResolutionId_fkey" FOREIGN KEY ("numberingResolutionId") REFERENCES "invoice_numbering_resolutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

