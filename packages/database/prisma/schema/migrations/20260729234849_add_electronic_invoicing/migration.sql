-- CreateEnum
CREATE TYPE "ElectronicInvoiceStatus" AS ENUM ('GENERATED', 'PENDING_SIGNATURE', 'PENDING_SUBMISSION', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "invoice_numbering_resolutions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "resolutionNumber" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "rangeFrom" INTEGER NOT NULL,
    "rangeTo" INTEGER NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_numbering_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electronic_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "numberingResolutionId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "cufe" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "customerDocumentType" TEXT NOT NULL,
    "customerDocumentNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxTotal" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "environment" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "status" "ElectronicInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "electronic_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_numbering_resolutions_companyId_branchId_isActive_idx" ON "invoice_numbering_resolutions"("companyId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_numbering_resolutions_companyId_prefix_key" ON "invoice_numbering_resolutions"("companyId", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_invoices_saleId_key" ON "electronic_invoices"("saleId");

-- CreateIndex
CREATE INDEX "electronic_invoices_companyId_branchId_createdAt_idx" ON "electronic_invoices"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_invoices_companyId_prefix_number_key" ON "electronic_invoices"("companyId", "prefix", "number");

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_invoices" ADD CONSTRAINT "electronic_invoices_numberingResolutionId_fkey" FOREIGN KEY ("numberingResolutionId") REFERENCES "invoice_numbering_resolutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
