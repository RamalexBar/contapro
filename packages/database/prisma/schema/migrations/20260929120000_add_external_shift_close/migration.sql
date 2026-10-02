-- CreateTable
CREATE TABLE "external_shift_closes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "journalEntryIds" TEXT[],
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_shift_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_shift_closes_companyId_createdAt_idx" ON "external_shift_closes"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_shift_closes_companyId_externalReference_key" ON "external_shift_closes"("companyId", "externalReference");
