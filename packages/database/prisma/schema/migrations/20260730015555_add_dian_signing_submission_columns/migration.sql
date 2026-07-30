-- AlterTable
ALTER TABLE "electronic_invoices" ADD COLUMN     "dianResponseXml" TEXT,
ADD COLUMN     "dianTrackingId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "signedXmlContent" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "electronic_invoices_companyId_status_idx" ON "electronic_invoices"("companyId", "status");
