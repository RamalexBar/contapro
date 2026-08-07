-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE "sales" ADD COLUMN     "exchangeRate" DECIMAL(14,4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE "purchases" ADD COLUMN     "exchangeRate" DECIMAL(14,4) NOT NULL DEFAULT 1;
