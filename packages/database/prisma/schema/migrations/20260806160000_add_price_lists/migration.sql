-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_list_entries" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "product_price_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_companyId_code_key" ON "price_lists"("companyId", "code");

-- CreateIndex
CREATE INDEX "price_lists_companyId_idx" ON "price_lists"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "product_price_list_entries_priceListId_productId_key" ON "product_price_list_entries"("priceListId", "productId");

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "priceListId" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "priceListId" TEXT;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "priceListId" TEXT;

-- AddForeignKey
ALTER TABLE "product_price_list_entries" ADD CONSTRAINT "product_price_list_entries_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
