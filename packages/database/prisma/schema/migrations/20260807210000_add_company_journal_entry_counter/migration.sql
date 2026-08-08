-- CreateTable
CREATE TABLE "company_journal_entry_counters" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "company_journal_entry_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_journal_entry_counters_companyId_key" ON "company_journal_entry_counters"("companyId");
