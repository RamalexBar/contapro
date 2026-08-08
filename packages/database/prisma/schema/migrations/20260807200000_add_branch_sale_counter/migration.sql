-- CreateTable
CREATE TABLE "branch_sale_counters" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "branch_sale_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_sale_counters_companyId_branchId_key" ON "branch_sale_counters"("companyId", "branchId");
