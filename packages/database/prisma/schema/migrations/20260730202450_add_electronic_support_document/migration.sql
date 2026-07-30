-- AlterEnum
ALTER TYPE "DianDocumentType" ADD VALUE 'DOCUMENTO_SOPORTE';

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "cuds" TEXT,
ADD COLUMN     "xmlUrl" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "isObligatedToInvoice" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "electronic_support_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "numberingResolutionId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "cuds" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "supplierDocumentType" TEXT NOT NULL,
    "supplierDocumentNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxTotal" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
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

    CONSTRAINT "electronic_support_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "electronic_support_documents_purchaseId_key" ON "electronic_support_documents"("purchaseId");

-- CreateIndex
CREATE INDEX "electronic_support_documents_companyId_branchId_createdAt_idx" ON "electronic_support_documents"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "electronic_support_documents_companyId_status_idx" ON "electronic_support_documents"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_support_documents_companyId_prefix_number_key" ON "electronic_support_documents"("companyId", "prefix", "number");

-- AddForeignKey
ALTER TABLE "electronic_support_documents" ADD CONSTRAINT "electronic_support_documents_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_support_documents" ADD CONSTRAINT "electronic_support_documents_numberingResolutionId_fkey" FOREIGN KEY ("numberingResolutionId") REFERENCES "invoice_numbering_resolutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
