-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN "purchaseId" TEXT;

-- CreateIndex
CREATE INDEX "goods_receipts_purchaseId_idx" ON "goods_receipts"("purchaseId");
