-- CreateEnum
CREATE TYPE "WithholdingType" AS ENUM ('RETEFUENTE', 'RETEICA', 'RETEIVA');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "retentionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "retentionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "withholding_concepts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WithholdingType" NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withholding_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_withholdings" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "withholdingConceptId" TEXT NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sale_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_withholdings" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "withholdingConceptId" TEXT NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "purchase_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withholding_concepts_companyId_idx" ON "withholding_concepts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "withholding_concepts_companyId_code_key" ON "withholding_concepts"("companyId", "code");

-- AddForeignKey
ALTER TABLE "sale_withholdings" ADD CONSTRAINT "sale_withholdings_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_withholdings" ADD CONSTRAINT "sale_withholdings_withholdingConceptId_fkey" FOREIGN KEY ("withholdingConceptId") REFERENCES "withholding_concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_withholdings" ADD CONSTRAINT "purchase_withholdings_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_withholdings" ADD CONSTRAINT "purchase_withholdings_withholdingConceptId_fkey" FOREIGN KEY ("withholdingConceptId") REFERENCES "withholding_concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
