-- CreateTable
CREATE TABLE "sales_commission_schemes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_commission_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_settlements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "salesBase" DECIMAL(14,2) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "journalEntryId" TEXT,

    CONSTRAINT "commission_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_commission_schemes_companyId_sellerUserId_key" ON "sales_commission_schemes"("companyId", "sellerUserId");

-- CreateIndex
CREATE INDEX "sales_commission_schemes_companyId_idx" ON "sales_commission_schemes"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "commission_settlements_companyId_sellerUserId_year_month_key" ON "commission_settlements"("companyId", "sellerUserId", "year", "month");

-- CreateIndex
CREATE INDEX "commission_settlements_companyId_idx" ON "commission_settlements"("companyId");
