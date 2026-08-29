-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wompiPaymentSourceId" TEXT,
ADD COLUMN     "cardLastFour" TEXT,
ADD COLUMN     "cardBrand" TEXT;
