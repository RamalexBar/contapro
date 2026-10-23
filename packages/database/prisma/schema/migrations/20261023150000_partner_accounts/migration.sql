-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "billedBy" TEXT;

-- CreateTable
CREATE TABLE "partner_accounts" (
    "id" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_accounts_companyId_key" ON "partner_accounts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_accounts_partner_externalId_key" ON "partner_accounts"("partner", "externalId");
